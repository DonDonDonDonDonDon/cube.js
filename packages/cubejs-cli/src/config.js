import inquirer from 'inquirer';
import fs from 'fs-extra';
import rp from 'request-promise';
import jwt from 'jsonwebtoken';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

export class Config {
  async loadConfig() {
    const { configFile } = this.configFile();

    if (await fs.pathExists(configFile)) {
      return fs.readJson(configFile);
    }

    return {};
  }

  async writeConfig(config) {
    const { cubeCloudConfigPath, configFile } = this.configFile();
    await fs.mkdirp(cubeCloudConfigPath);
    await fs.writeJson(configFile, config);
  }

  configFile() {
    const cubeCloudConfigPath = this.cubeCloudConfigPath();
    const configFile = path.join(cubeCloudConfigPath, 'config.json');
    return { cubeCloudConfigPath, configFile };
  }

  async envFile(envFile) {
    if (await fs.pathExists(envFile)) {
      return dotenv.config({ path: envFile }).parsed;
    }
    return {};
  }

  cubeEnvConfigPath() {
    return path.join(os.homedir(), '.env');
  }

  cubeCloudConfigPath() {
    return path.join(os.homedir(), '.cubecloud');
  }

  async deployAuth(url) {
    if (process.env.CUBE_CLOUD_DEPLOY_AUTH) {
      const payload = jwt.decode(process.env.CUBE_CLOUD_DEPLOY_AUTH);
      if (!payload || typeof payload !== 'object' || !payload.url) {
        throw new Error('Malformed token in CUBE_CLOUD_DEPLOY_AUTH');
      }

      if (url && payload.url !== url) {
        throw new Error('CUBE_CLOUD_DEPLOY_AUTH token doesn\'t match url in .cubecloud');
      }
      return {
        [payload.url]: {
          auth: process.env.CUBE_CLOUD_DEPLOY_AUTH
        }
      };
    }
    const config = await this.loadConfig();
    if (config.auth) {
      return config.auth;
    } else {
      const auth = await inquirer.prompt([{
        name: 'auth',
        message: `Cube Cloud Auth Token${url ? ` for ${url}` : ''}`
      }]);
      const authToken = auth.auth;
      return (await this.addAuthToken(authToken, config)).auth;
    }
  }

  async addAuthToken(authToken, config) {
    if (!config) {
      config = await this.loadConfig();
    }

    const payload = jwt.decode(authToken);
    if (payload && typeof payload === 'object' && payload.url) {
      config.auth = config.auth || {};
      config.auth[payload.url] = {
        auth: authToken
      };

      await this.writeConfig(config);
      return config;
    }

    const answer = await this.cloudTokenReq(authToken);
    if (answer) {
      return this.addAuthToken(answer, config);
    }

    // eslint-disable-next-line no-throw-literal
    throw 'Malformed Cube Cloud token';
  }

  async deployAuthForCurrentDir() {
    const dotCubeCloud = await this.loadDotCubeCloud();
    if (dotCubeCloud.url && dotCubeCloud.deploymentId) {
      const deployAuth = await this.deployAuth(dotCubeCloud.url);
      if (!deployAuth[dotCubeCloud.url]) {
        throw new Error(`Provided token isn't for ${dotCubeCloud.url}`);
      }
      return {
        ...deployAuth[dotCubeCloud.url],
        url: dotCubeCloud.url,
        deploymentId: dotCubeCloud.deploymentId
      };
    }
    const auth = await this.deployAuth();
    let url = Object.keys(auth)[0];
    if (Object.keys(auth).length > 1) {
      // eslint-disable-next-line prefer-destructuring
      url = (await inquirer.prompt([{
        type: 'list',
        name: 'url',
        message: 'Please select an organization',
        choices: Object.keys(auth)
      }])).url;
    }
    const authToken = auth[url];
    const deployments = await this.cloudReq({
      url: () => 'build/deploy/deployments',
      method: 'GET',
      auth: { ...authToken, url }
    });
    if (!Array.isArray(deployments)) {
      throw new Error(deployments.toString());
    }
    if (!deployments.length) {
      // eslint-disable-next-line no-throw-literal
      throw `${url} doesn't have any managed deployments. Please create one.`;
    }
    const { deployment } = await inquirer.prompt([{
      type: 'list',
      name: 'deployment',
      message: 'Please select a deployment to deploy to',
      choices: deployments
    }]);
    const deploymentId = deployments.find(d => d.name === deployment).id;
    await this.writeDotCubeCloud({
      url,
      deploymentId
    });
    return {
      ...authToken,
      url,
      deploymentId
    };
  }

  async loadDeployAuth() {
    this.preLoadDeployAuth = await this.deployAuthForCurrentDir();
  }

  dotCubeCloudFile() {
    return '.cubecloud';
  }

  async loadDotCubeCloud() {
    if (await fs.pathExists(this.dotCubeCloudFile())) {
      return fs.readJson(this.dotCubeCloudFile());
    }

    return {};
  }

  async writeDotCubeCloud(config) {
    await fs.writeJson(this.dotCubeCloudFile(), config);
  }

  async cloudReq(options) {
    const { url, auth, ...restOptions } = options;
    const authorization = auth || this.preLoadDeployAuth;
    if (!authorization) {
      throw new Error('Auth isn\'t set');
    }
    return rp({
      headers: {
        authorization: authorization.auth
      },
      ...restOptions,
      url: `${authorization.url}/${url(authorization.deploymentId)}`,
      json: true
    });
  }

  async cloudTokenReq(authToken) {
    const res = await rp({
      url: `${process.env.CUBE_CLOUD_HOST || 'https://cubecloud.dev'}/v1/token`,
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      json: true,
      body: {
        token: authToken
      }
    });
    
    if (res && res.error) {
      throw res.error;
    }
    
    return res.jwt;
  }
}

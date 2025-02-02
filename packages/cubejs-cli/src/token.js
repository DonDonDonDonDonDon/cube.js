import chalk from 'chalk';
import jwt from 'jsonwebtoken';
import { event, requireFromPackage } from './utils';

export const defaultExpiry = '30 days';

const parsePayload = (payloadArray = []) => {
  const result = {};

  payloadArray.forEach((entry = '') => {
    const [key, value] = entry.split('=');
    if (key && value) result[key] = value;
  });

  return result;
};

export const token = async (options = {}) => {
  event('Generate Token');
  const CubejsServer = await requireFromPackage('@cubejs-backend/server');
  const { expiry = defaultExpiry, secret = CubejsServer.apiSecret() } = options;
  if (!secret) throw new Error('No app secret found').message;

  const extraOptions = {};
  if (expiry !== '0') extraOptions.expiresIn = expiry;

  const payload = parsePayload(options.payload);
  payload.u = parsePayload(options.userContext);

  console.log('Generating Cube.js JWT token');
  console.log('');
  console.log(`${chalk.yellow('-----------------------------------------------------------------------------------------')}`);
  console.log(`  ${chalk.yellow('Use these manually generated tokens in production with caution.')}`);
  console.log(`  ${chalk.yellow(`Please refer to ${chalk.cyan('https://cube.dev/docs/security')} for production security best practices.`)}`);
  console.log(`${chalk.yellow('-----------------------------------------------------------------------------------------')}`);
  console.log('');
  console.log(`Expires in: ${chalk.green(expiry)}`);
  console.log(`Payload: ${chalk.green(JSON.stringify(payload))}`);
  console.log('');

  const signedToken = jwt.sign(payload, secret, extraOptions);
  console.log(`Token: ${chalk.green(signedToken)}`);
  await event('Generate Token Success');
  return signedToken;
};

export const collect = (val, memo) => [val, ...memo];

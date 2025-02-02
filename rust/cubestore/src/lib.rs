#![feature(in_band_lifetimes)]
#![feature(specialization)]
#![feature(test)]
#![feature(backtrace)]
#![feature(async_closure)]
#![feature(drain_filter)]
// #![feature(trace_macros)]

// trace_macros!(true);
#[macro_use]
extern crate lazy_static;

use flexbuffers::DeserializationError;
use sqlparser::parser::ParserError;
use parquet::errors::ParquetError;
use tokio::sync::mpsc::error::SendError;
use std::backtrace::Backtrace;
use core::fmt;
use smallvec::alloc::fmt::Formatter;
use datafusion::error::ExecutionError;
use arrow::error::ArrowError;

pub mod http;
pub mod remotefs;
pub mod table;
pub mod metastore;
pub mod sql;
pub mod mysql;
pub mod store;
pub mod scheduler;
pub mod cluster;
pub mod queryplanner;
pub mod import;
pub mod config;


#[derive(Debug, Clone)]
pub struct CubeError {
    message: String,
    cause: CubeErrorCauseType
}

#[derive(Debug, Clone)]
pub enum CubeErrorCauseType {
    User,
    Internal
}

impl CubeError {
    fn user(message: String) -> CubeError {
        CubeError {
            message, cause: CubeErrorCauseType::User
        }
    }

    fn internal(message: String) -> CubeError {
        CubeError {
            message, cause: CubeErrorCauseType::Internal
        }
    }
}

impl fmt::Display for CubeError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.write_fmt(format_args!("{:?}: {}", self.cause, self.message))
    }
}

impl From<flexbuffers::DeserializationError> for CubeError {
    fn from(v: DeserializationError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<rocksdb::Error> for CubeError {
    fn from(v: rocksdb::Error) -> Self {
        CubeError::internal(v.into_string())
    }
}

impl From<std::io::Error> for CubeError {
    fn from(v: std::io::Error) -> Self {
        CubeError::internal(format!("{:?}\n{}", v, Backtrace::capture()))
    }
}

impl From<ParserError> for CubeError {
    fn from(v: ParserError) -> Self {
        CubeError::internal(format!("{:?}", v))
    }
}

impl From<CubeError> for warp::reject::Rejection {
    fn from(_: CubeError) -> Self { // TODO
        warp::reject()
    }
}

impl From<ParquetError> for CubeError {
    fn from(v: ParquetError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<tokio::task::JoinError> for CubeError {
    fn from(v: tokio::task::JoinError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<SendError<metastore::MetaStoreEvent>> for CubeError {
    fn from(v: SendError<metastore::MetaStoreEvent>) -> Self {
        CubeError::internal(format!("{:?}\n{}", v, Backtrace::capture()))
    }
}

impl From<std::time::SystemTimeError> for CubeError {
    fn from(v: std::time::SystemTimeError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<tokio::time::Elapsed> for CubeError {
    fn from(v: tokio::time::Elapsed) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<datafusion::error::ExecutionError> for CubeError {
    fn from(v: ExecutionError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<CubeError> for datafusion::error::ExecutionError {
    fn from(v: CubeError) -> Self {
        datafusion::error::ExecutionError::General(v.to_string())
    }
}

impl From<arrow::error::ArrowError> for CubeError {
    fn from(v: ArrowError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<tokio::sync::broadcast::RecvError> for CubeError {
    fn from(v: tokio::sync::broadcast::RecvError) -> Self {
        CubeError::internal(format!("{:?}\n{}", v, Backtrace::capture()))
    }
}

impl From<tokio::sync::broadcast::SendError<metastore::MetaStoreEvent>> for CubeError {
    fn from(v: tokio::sync::broadcast::SendError<metastore::MetaStoreEvent>) -> Self {
        CubeError::internal(format!("{:?}\n{}", v, Backtrace::capture()))
    }
}

impl From<tokio::sync::broadcast::SendError<cluster::JobEvent>> for CubeError {
    fn from(v: tokio::sync::broadcast::SendError<cluster::JobEvent>) -> Self {
        CubeError::internal(format!("{:?}\n{}", v, Backtrace::capture()))
    }
}

impl From<bigdecimal::ParseBigDecimalError> for CubeError {
    fn from(v: bigdecimal::ParseBigDecimalError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<flexbuffers::SerializationError> for CubeError {
    fn from(v: flexbuffers::SerializationError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<s3::S3Error> for CubeError {
    fn from(v: s3::S3Error) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<awscreds::AwsCredsError> for CubeError {
    fn from(v: awscreds::AwsCredsError) -> Self {
        CubeError::user(v.to_string())
    }
}

impl From<awsregion::AwsRegionError> for CubeError {
    fn from(v: awsregion::AwsRegionError) -> Self {
        CubeError::user(v.to_string())
    }
}

impl From<chrono::ParseError> for CubeError {
    fn from(v: chrono::ParseError) -> Self {
        CubeError::internal(v.to_string())
    }
}

impl From<std::string::FromUtf8Error> for CubeError {
    fn from(v: std::string::FromUtf8Error) -> Self {
        CubeError::internal(v.to_string())
    }
}
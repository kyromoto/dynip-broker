import * as path from "@std/path";

import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getRotatingFileSink } from "@logtape/file";

import { DENO_ENV, LOG_LEVEL } from "../share/environments.ts";
import { config } from "../share/config.ts";

const appLogFile = path.join(path.dirname(config.server.logger.folder), "dynip-broker.app.jsonl");
const httpLogFile = path.join(path.dirname(config.server.logger.folder), "dynip-broker.http.jsonl");

await configure({
    sinks: {
        console: getConsoleSink(),
        appJSON: getRotatingFileSink(appLogFile, {
            formatter: record => JSON.stringify(record) + "\n",
            maxSize: config.server.logger.app.max_file_size,
            maxFiles: config.server.logger.app.max_files
        }),
        httpJSON: getRotatingFileSink(httpLogFile, {
           formatter: record => JSON.stringify(record) + "\n",
           maxSize: config.server.logger.http.max_file_size,    
           maxFiles: config.server.logger.http.max_files 
        })
    },
    loggers: [
        { category: "app", lowestLevel: LOG_LEVEL, sinks: ["appJSON", ...(DENO_ENV === "development" ? ["console"] : [])] },
        { category: "http", lowestLevel: LOG_LEVEL, sinks: ["httpJSON"] },
        { category: ["logtape", "meta"], lowestLevel: LOG_LEVEL, sinks: ["console"] },
    ]
});

export const logger = getLogger(["app"]);
export const httpLogger = getLogger(["http"]);

logger.info(`logger initialized with level: ${LOG_LEVEL.toUpperCase()}`, { logLevel: LOG_LEVEL })
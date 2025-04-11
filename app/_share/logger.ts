import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getRotatingFileSink } from "@logtape/file";

import { LOG_LEVEL } from "../_environments.ts";
import { config } from "../config.ts";



await configure({
    sinks: {
        console: getConsoleSink(),
        appJSON: getRotatingFileSink(config.server.logger.app.file, {
            formatter: record => JSON.stringify(record) + "\n",
            maxSize: config.server.logger.app.max_file_size,
            maxFiles: config.server.logger.app.max_files
        }),
        metaJSON: getRotatingFileSink(config.server.logger.meta.file, {
            formatter: record => JSON.stringify(record) + "\n",
            maxSize: config.server.logger.meta.max_file_size,
            maxFiles: config.server.logger.meta.max_files
        }),
    },
    loggers: [
        { category: "app", lowestLevel: LOG_LEVEL, sinks: ["console", "appJSON"] },
        { category: ["logtape", "meta"], lowestLevel: "debug", sinks: ["metaJSON"] },
    ]
});

export const logger = getLogger(["app"]);

logger.info(`logger initialized with level: ${LOG_LEVEL.toUpperCase()}`, { logLevel: LOG_LEVEL })
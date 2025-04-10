import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getRotatingFileSink } from "@logtape/file";

import { LOG_FILE_MAX_SIZE, LOG_FILE_MAX_FILES, LOG_LEVEL } from "./_environments.ts";



await configure({
    sinks: {
        console: getConsoleSink(),
        appJSON: getRotatingFileSink("dynip-broker.app.jsonl", {
            formatter: record => JSON.stringify(record) + "\n",
            maxSize: LOG_FILE_MAX_SIZE,
            maxFiles: LOG_FILE_MAX_FILES
        }),
        metaJSON: getRotatingFileSink("dynip-broker.meta.jsonl", {
            formatter: record => JSON.stringify(record) + "\n",
            maxSize: LOG_FILE_MAX_SIZE,
            maxFiles: LOG_FILE_MAX_FILES
        }),
    },
    loggers: [
        { category: "app", lowestLevel: LOG_LEVEL, sinks: ["console", "appJSON"] },
        { category: ["logtape", "meta"], lowestLevel: "debug", sinks: ["metaJSON"] },
    ]
});

export const logger = getLogger(["app"]);

logger.info(`logger initialized with level: ${LOG_LEVEL.toUpperCase()}`, { logLevel: LOG_LEVEL })
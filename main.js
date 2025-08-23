import config from "3lib-config";
import fs from "fs";
import fsp from "fs/promises";
import cors from "cors";
import process from "process";
import express from "express";

config.init();
console.log("3suite-mock-server initialized");
if (config.get("verbose")) {
  console.log("Configuration loaded", config.get());
}

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express();

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb" }));
app.use(cors());

if (config.get("verbose")) {
  console.log("Express middleware configured");
  console.log("Middleware details", {
    jsonLimit: "500mb",
    urlencodedLimit: "500mb",
    corsEnabled: true
  });
}

app.post("*", (req, res) => {
  handleRequest(req, res, "POST");
});

app.get("*", (req, res) => {
  handleRequest(req, res, "GET");
});

app.put("*", (req, res) => {
  handleRequest(req, res, "PUT");
});

app.options("*", (req, res) => {
  handleRequest(req, res, "OPTIONS");
});

if (config.get("verbose")) {
  console.log("Route handlers registered for POST, GET, PUT, OPTIONS");
}

async function convertObject(obj, index) {
  if (config.get("verbose")) {
    console.log("Converting object for file index", index, "with keys", Object.keys(obj));
  }

  let newObj = {};
  for (let key of Object.keys(obj)) {
    if (typeof obj[key] === "object") {
      newObj[key] = await convertObject(obj[key], index);
    } else if (typeof obj[key] === "string") {
      let value = obj[key];
      let replacementCount = 0;

      while (
        value.includes(
          config.get("responseReplacement/indicator", "${")
        )
      ) {
        let start = value.indexOf(
          config.get("responseReplacement/indicator", "${")
        );
        let end = value.indexOf(
          config.get("responseReplacement/end", "}"),
          start,
        );
        let variable = value.substring(
          start +
            config.get("responseReplacement/indicator", "${").length,
          end,
        );

        let fileIndex = parseInt(variable);
        let filePath = config.get("files")[fileIndex];

        if (config.get("verbose")) {
          console.log("Replacing variable", variable, "with file", filePath);
        }

        let replacement = await fsp.readFile(filePath, {
          encoding: "base64",
        });

        value =
          value.substring(0, start) +
          replacement +
          value.substring(
            end + config.get("responseReplacement/end", "}").length,
          );

        replacementCount++;
      }

      if (replacementCount > 0 && config.get("verbose")) {
        console.log("Completed", replacementCount, "replacements for key", key);
      }

      newObj[key] = value;
    } else {
      newObj[key] = obj[key];
    }
  }

  return newObj;
}

let currentFileIndex = 0;
async function handleRequest(req, res, method) {
  const requestStart = Date.now();

  let fileIndex = ++currentFileIndex % config.get("files").length;
  if (config.get("randomizeOrder", false)) {
    fileIndex = Math.floor(Math.random() * config.get("files").length);
  }

  let waitTime =
    config.get("time/base", 0) + Math.random() * config.get("time/addRandom", 0);

  console.log("Request received", {
    method: method,
    url: req.url,
    fileIndex: fileIndex,
    waitTime: waitTime
  });

  if (config.get("verbose")) {
    console.log("Request details", {
      headers: req.headers,
      userAgent: req.get('User-Agent'),
      remoteAddress: req.connection?.remoteAddress || req.ip,
      body: method !== 'GET' ? req.body : undefined,
      query: req.query,
      params: req.params,
      totalFiles: config.get("files").length,
      currentIndex: currentFileIndex,
      randomized: config.get("randomizeOrder", false)
    });
  }

  await sleep(waitTime);

  try {
    if (config.get("asJson", false)) {
      console.log("Sending JSON response using file index", fileIndex);

      let response = structuredClone(config.get("responseFormat"));
      response = await convertObject(response, fileIndex);

      if (config.get("verbose")) {
        console.log("JSON response prepared", {
          originalFormat: config.get("responseFormat"),
          processedKeys: Object.keys(response)
        });
      }

      res.json(response);
    } else {
      const filePath = config.get("files")[fileIndex];
      console.log("Sending file response", filePath);

      if (config.get("verbose")) {
        console.log("File details", {
          absolutePath: filePath,
          exists: fs.existsSync(filePath)
        });
      }

      res.sendFile(filePath, { root: '.' });
    }

    const duration = Date.now() - requestStart;
    console.log("Request completed", {
      method: method,
      url: req.url,
      duration: duration,
      status: res.statusCode || 200
    });

  } catch (e) {
    const duration = Date.now() - requestStart;
    console.log("Request failed", {
      method: method,
      url: req.url,
      error: e.message,
      duration: duration
    });

    if (config.get("verbose")) {
      console.log("Error details", {
        stack: e.stack,
        fileIndex: fileIndex,
        filePath: config.get("files")[fileIndex],
        errorType: e.constructor.name
      });
    }

    res.status(500).end("error");
  }
}

let port = config.get("port", 3000);
app.listen(port, () => {
  console.log("Server started", {
    port: port,
    filesConfigured: config.get("files", []).length,
    jsonMode: config.get("asJson", false),
    verboseMode: config.get("verbose", false)
  });

  if (config.get("verbose")) {
    console.log("Server configuration", {
      allFiles: config.get("files", []),
      responseFormat: config.get("responseFormat"),
      baseWaitTime: config.get("time/base", 0),
      randomWaitTime: config.get("time/addRandom", 0),
      randomizeOrder: config.get("randomizeOrder", false),
      replacementIndicator: config.get("responseReplacement/indicator", "${"),
      replacementEnd: config.get("responseReplacement/end", "}")
    });
  }
});

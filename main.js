import config from "3lib-config";
import fs from "fs";
import fsp from "fs/promises";
import cors from "cors";
import process from "process";
import express from "express";

config.init();

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express();

app.use(express.json({ limit: "500mb" })); // for parsing application/json
app.use(express.urlencoded({ limit: "500mb" }));
app.use(cors());

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

async function convertObject(obj, index) {
  let newObj = {};
  for (let key of Object.keys(obj)) {
    if (typeof obj[key] === "object") {
      newObj[key] = await convertObject(obj[key], index);
    } else if (typeof obj[key] === "string") {
      let value = obj[key];
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

        let index = parseInt(variable);
        let replacement = await fsp.readFile(config.get("files")[index], {
          encoding: "base64",
        });
        value =
          value.substring(0, start) +
          replacement +
          value.substring(
            end + config.get("responseReplacement/end", "}").length,
          );
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
  let fileIndex = currentFileIndex++;
  if (config.get("randomizeOrder", false)) {
    fileIndex = Math.floor(Math.random() * config.get("files").length);
  }
  let waitTime =
    config.get("time/base", 0) + Math.random() * config.get("time/addRandom", 0);
  console.log("executing request", req.url, "waiting", waitTime);
  await sleep(waitTime);

  try {
    if (config.get("asJson", false)) {
      let response = structuredClone(config.get("responseFormat"));
      response = await convertObject(response, fileIndex);
      res.json(response);
    } else {
      res.sendFile(config.get("files")[fileIndex], { root: '.' });
    }
  } catch (e) {
    console.log("error with request");
    console.log(e);
    res.end("error");
  }
}

let port = config.get("port", 3000);
app.listen(port, () => {
  console.log(`3suite-mock-server listening on port ${port}`);
});

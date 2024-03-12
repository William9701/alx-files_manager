import { ObjectID } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import redisClient from "../utils/redis";
import dbClient from "../utils/db";

class FilesController {
  static async postUpload(req, res) {
    const token = req.header("X-Token");
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      res.status(400).json({ error: "Missing name" });
      return;
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      res.status(400).json({ error: "Missing type" });
      return;
    }
    if (!data && type !== "folder") {
      res.status(400).json({ error: "Missing data" });
      return;
    }

    const file = {
      name,
      type,
      userId,
      parentId,
      isPublic,
    };
    const files = dbClient.db.collection("files");

    if (parentId) {
      const idObject = ObjectID(parentId);
      const parentFolder = await files.findOne({ _id: idObject });
      if (!parentFolder) {
        res.status(400).json({ error: "Parent not found" });
        return;
      }
      if (parentFolder.type !== "folder") {
        res.status(400).json({ error: "Parent is not a folder" });
        return;
      }
    }

    if (type === "folder") {
      const result = await files.insertOne(file);
      const [{ name, _id, isPublic, userId, type, parentId }] = result.ops;
      res.status(201).json({
        id: _id.toString(),
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
      return;
    }
    const folderPath = process.env.FOLDER_PATH || "/tmp/files_manager";
    await fs.promises.mkdir(folderPath, { recursive: true });
    const filePath = `${folderPath}/${uuidv4()}`;
    await fs.promises.writeFile(filePath, Buffer.from(data, "base64"));
    file.localPath = filePath;
    if (type !== "folder") {
      console.log(file);
      const result = await files.insertOne(file);
      const [{ name, _id, isPublic, userId, type, parentId }] = result.ops;
      res.status(201).json({
        id: _id.toString(),
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }
  }
}

module.exports = FilesController;

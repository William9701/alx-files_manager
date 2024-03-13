/* eslint-disable linebreak-style */
import { ObjectID } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import mime from 'mime-types';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const Bull = require('bull');

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Missing name' });
      return;
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      res.status(400).json({ error: 'Missing type' });
      return;
    }
    if (!data && type !== 'folder') {
      res.status(400).json({ error: 'Missing data' });
      return;
    }

    const file = {
      name,
      type,
      userId,
      parentId,
      isPublic,
    };
    const files = dbClient.db.collection('files');

    if (parentId) {
      const idObject = ObjectID(parentId);
      const parentFolder = await files.findOne({ _id: idObject });
      if (!parentFolder) {
        res.status(400).json({ error: 'Parent not found' });
        return;
      }
      if (parentFolder.type !== 'folder') {
        res.status(400).json({ error: 'Parent is not a folder' });
        return;
      }
    }

    if (type === 'folder') {
      const result = await files.insertOne(file);
      const [{
        name, _id, isPublic, userId, type, parentId,
      }] = result.ops;
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
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    await fs.promises.mkdir(folderPath, { recursive: true });
    const filePath = `${folderPath}/${uuidv4()}`;
    await fs.promises.writeFile(filePath, Buffer.from(data, 'base64'));
    file.localPath = filePath;
    if (type !== 'folder') {
      console.log(file);
      const result = await files.insertOne(file);
      const [{
        name, _id, isPublic, userId, type, parentId,
      }] = result.ops;
      res.status(201).json({
        id: _id.toString(),
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
      if (type === 'image') {
        await fileQueue.add({ userId, fileId: _id });
      }
    }
  }

  static async getShow(req, res) {
    const authToken = req.header('X-Token');
    const authKey = `auth_${authToken}`;
    const userIdentifier = await redisClient.get(authKey);
    if (!userIdentifier) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const fileCollection = dbClient.db.collection('files');
    const fileID = new ObjectID(id);
    const userID = new ObjectID(userIdentifier);
    const fileData = await fileCollection.findOne({
      _id: fileID,
      userId: userID,
    });
    if (!fileData) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.status(200).json(fileData);
  }

  static async getIndex(req, res) {
    const authToken = req.header('X-Token');
    const authKey = `auth_${authToken}`;
    const currentUser = await redisClient.get(authKey);
    if (!currentUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { parentId, page = 0 } = req.query;
    const fileCollection = dbClient.db.collection('files');
    let searchQuery;
    if (!parentId) {
      searchQuery = { userId: ObjectID(currentUser) };
    } else {
      searchQuery = {
        parentId: ObjectID(parentId),
        userId: ObjectID(currentUser),
      };
    }
    console.log(searchQuery);
    const aggregatedResult = await fileCollection
      .aggregate([
        { $match: searchQuery },
        { $skip: parseInt(page, 10) * 20 },
        { $limit: 20 },
      ])
      .toArray();
    const upArray = aggregatedResult.map(({ _id, ...remaining }) => ({
      id: _id,
      ...remaining,
    }));
    res.status(200).json(upArray);
  }

  static async putPublish(req, res) {
    const authToken = req.header('X-Token');
    const authKey = `auth_${authToken}`;
    const userIdentifier = await redisClient.get(authKey);
    if (!userIdentifier) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const fileCollection = dbClient.db.collection('files');
    const fileID = new ObjectID(id);
    const userID = new ObjectID(userIdentifier);
    const fileData = await fileCollection.findOne({
      _id: fileID,
      userId: userID,
    });
    if (!fileData) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    fileData.isPublic = true;
    res.json(fileData);
  }

  static async putUnpublish(req, res) {
    const authToken = req.header('X-Token');
    const authKey = `auth_${authToken}`;
    const userIdentifier = await redisClient.get(authKey);
    if (!userIdentifier) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const fileCollection = dbClient.db.collection('files');
    const fileID = new ObjectID(id);
    const userID = new ObjectID(userIdentifier);
    const fileData = await fileCollection.findOne({
      _id: fileID,
      userId: userID,
    });
    if (!fileData) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    fileData.isPublic = false;
    res.json(fileData);
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;
    const fileCollection = dbClient.db.collection('files');
    const fileID = new ObjectID(id);
    const fileData = await fileCollection.findOne({ _id: fileID });
    if (!fileData) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const authToken = req.header('X-Token');
    const authKey = `auth_${authToken}`;
    const userIdentifier = await redisClient.get(authKey);

    if (
      !fileData.isPublic
      && (!userIdentifier || fileData.userId.toString() !== userIdentifier)
    ) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (fileData.type === 'folder') {
      res.status(400).json({ error: "A folder doesn't have content" });
      return;
    }
    let filename = fileData.localPath;
    if (size) {
      const validSizes = ['500', '250', '100'];
      if (!validSizes.includes(size)) {
        res.status(400).json({ error: 'Invalid size' });
        return;
      }
      filename = `${fileData.localPath}_${size}`;
    }

    fs.stat(fileData.localPath, (err) => {
      if (err) {
        res.status(404).json({ error: 'Not found' });
      }
    });

    const mimeType = mime.lookup(fileData.name);
    res.setHeader('Content-Type', mimeType);
    const fileContent = await fs.promises.readFile(filename);
    res.status(200).send(fileContent);
  }
}

module.exports = FilesController;

const db = require('../utils/db');
const redis = require('../utils/redis');

exports.getStatus = async (req, res) => {
  const isRedisAlive = await redis.isAlive();
  const isDbAlive = await db.isAlive();

  res.status(200).json({ redis: isRedisAlive, db: isDbAlive });
};

exports.getStats = async (req, res) => {
  const numUsers = await db.nbUsers();
  const numFiles = await db.nbFiles();

  res.status(200).json({ users: numUsers, files: numFiles });
};

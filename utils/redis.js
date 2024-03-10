/* eslint-disable quotes */
const redis = require("redis");
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on("error", (error) => {
      console.error(error);
    });
    this.client.on('ready', () => {
      this.isConnected = true;
    });
    this.Get = promisify(this.client.get).bind(this.client);
    this.SetExp = promisify(this.client.set).bind(this.client);
    this.Del = promisify(this.client.del).bind(this.client);
    this.isConnected = false;
  }

  isAlive() {
    return this.isConnected;
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (error, value) => {
        if (error) return reject(error);
        return resolve(value);
      });
    });
  }

  async set(key, value, duration) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, "EX", duration, (error, reply) => {
        if (error) return reject(error);
        return resolve(reply);
      });
    });
  }

  async del(key) {
    return new Promise((resolve, reject) => {
      this.client.del(key, (error, count) => {
        if (error) return reject(error);
        return resolve(count);
      });
    });
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;

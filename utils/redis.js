/* eslint-disable quotes */
const redis = require("redis");

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on("error", (error) => {
      console.error(error);
    });
  }

  isAlive() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.client.connected);
      }, 5000); // Delay of 5 seconds
    });
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

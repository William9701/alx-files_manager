import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || '27017';
    this.database = process.env.DB_DATABASE || 'files_manager';
    this.client = new MongoClient(
      `mongodb://${this.host}:${this.port}/${this.database}`
    );
    this.client.connect();
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const users = this.client.db(this.database).collection('users');
    const result = await users.countDocuments();
    return result;
  }

  async nbFiles() {
    const users = this.client.db(this.database).collection('files');
    const result = await users.countDocuments();
    return result;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;

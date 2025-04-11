require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;
const NODE_ENV = process.env.NODE_ENV || DEV;
const PORT = process.env.PORT || 8200;

const CONFIG = {
  MONGO_URI,
  NODE_ENV,
  PORT,
};

module.exports = { CONFIG };

import UsersController from '../controllers/UsersController';
const AppController = require("../controllers/AppController");

const express = require("express");

const router = express.Router();


router.get("/status", AppController.getStatus);
router.get("/stats", AppController.getStats);
router.post('/users', UsersController.postNew);
module.exports = router;

const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendor.controller");
const auth = require("../middlewares/auth.middleware");

router.use(auth);

router.get("/", vendorController.getAll);
router.get("/:id", vendorController.getById);
router.post("/", vendorController.create);
router.put("/:id", vendorController.update);
router.delete("/:id", vendorController.deactivate);

module.exports = router;

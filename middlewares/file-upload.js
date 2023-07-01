const multer = require("multer");

const MIME_TYPE_MAP = {
  "image/png": "png",
  "image/jpg": "jpg",
  "image/jpeg": "jpeg",
};
const uuid = require("uuid").v4;
const fileUpload = multer({
  limits: 500000,
  storage: multer.diskStorage({
    destination: "uploads/images",
    filename: function (req, file, cb) {
      const ext = MIME_TYPE_MAP[file.mimetype];
      cb(null, uuid() + "." + ext);
    },
  }),
  fileFilter: (req, file, cb) => {
    const isValid = !!MIME_TYPE_MAP[file.mimetype]; // !! converting to true or false(undf, null)
    let error = isValid ? null : new Error("Invalid mime type!");
    cb(error, isValid); // isvalid accepts the file or doesnt
  },
});

// const configuredMulterMiddleware = upload.single("image");

module.exports = fileUpload;

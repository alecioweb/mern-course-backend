const mongoose = require("mongoose");

const schema = mongoose.Schema;

const placeSchema = new schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  address: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  creator: { type: mongoose.Types.ObjectId, required: true, ref: "User" }, // ref curr place sch and user sch
});

module.exports = mongoose.model("Place", placeSchema);

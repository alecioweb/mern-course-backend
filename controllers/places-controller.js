const fs = require("fs");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

async function getPlaceById(req, res) {
  const placeId = req.params.pid;
  let place;

  //could fail if missing info
  try {
    //findbyid does not return real promise
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Something went wrong!", 500);
    return next(error);
  }

  if (!place) {
    const error = new HttpError(
      "Could not find place for the provided id.",
      404
    );
    return next(error);
    //use throw in sync code(Node), next in async code and forward the error
    // const error = new Error("Could not find place for the provided id.");
    // error.code = 404;
    // throw error;
    // return res.status(404).json({ message: "not found" });
  }

  //geters get rid of _ in _id
  res.json({ place: place.toObject({ getters: true }) }); // => {place} => {place: place}
}

async function getPlacesByUserId(req, res, next) {
  const userId = req.params.uid;

  let places;
  try {
    places = await Place.find({ creator: userId });
  } catch (err) {
    const error = new HttpError(
      "Could not find places for this user. Please try again later!",
      500
    );
    return next(error);
  }

  //FINDING PLACES ALTERNATIVE
  // let userWithPlaces;
  // try {
  //   userWithPlaces = await User.findById(userId).populate('places');
  // }catch(err){
  //   const error = new HttpError(
  //         "Could not find places for this user. Please try again later!",
  //         500
  //       );
  //       return next(error);
  // }

  if (!places || places.length === 0) {
    // const error = new Error("Could not find place for the provided user id.");
    // error.code = 404;
    return next(
      new HttpError("Could not find places for the provided user id.", 404)
    );
  }

  res.json({ places: places.map((p) => p.toObject({ getters: true })) });
}

async function createPlace(req, res, next) {
  //looks into req and checks if any errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("invalid inputs, please check your data", 422));
  }

  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  //objecid will be created here
  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    return next(new HttpError("Could not create place, try again."));
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id", 500);
    return next(error);
  }

  try {
    //ADD COLLECTION IF NOT EXISTING
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace); /* push provided by mongoose
mongodb gets place id from mongoose and adds it to user
    */
    await user.save({ session: sess });
    await sess.commitTransaction(); // ONLY AT THIS POINT THE DATA IS SAVED IN THE DATABASE
  } catch (err) {
    //database validation failed or is down
    console.log(err);
    const error = new HttpError("Could not create a place", 500);
    return next(error);
  }

  //201 successfully created
  res.status(201).json({ place: createdPlace });
}

async function updatePlace(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("invalid inputs, please check your data", 422));
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong! Could not find place.",
      500
    );
    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to edit this place because you are not its creator!",
      401
    );
    return next(error);
  }

  // const place = { ...DUMMY_PLACES.find((place) => place.id === placeId) };
  // const placeIndex = DUMMY_PLACES.findIndex((place) => place.id === placeId);
  // DUMMY_PLACES[placeIndex] = place;

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong! Could not update place.",
      500
    );
    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
}

async function deletePlace(req, res, next) {
  const placeId = req.params.pid;
  let place;

  try {
    //working with other docs in dif collect. uses (ref) in schema
    place = await Place.findById(placeId).populate("creator"); // finds creator with id
  } catch (err) {
    const error = new HttpError(
      "Something went wrong! Could not find this place.",
      500
    );
    return next(error);
  }

  if (!place) {
    return next(new HttpError("Could not find a place for this id", 404));
  }

  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to delete this place",
      401
    );
    return next(error);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.deleteOne({ session: sess });
    //creator gives full user obj link to place
    await place.creator.places.pull(place); // removes id from user places
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong! Could not delete this place.",
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted place" });
}

module.exports = {
  getPlacesByUserId: getPlacesByUserId,
  getPlaceById: getPlaceById,
  createPlace: createPlace,
  updatePlace: updatePlace,
  deletePlace: deletePlace,
};

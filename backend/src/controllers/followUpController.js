import { FollowUp } from "../models/FollowUp.js";

export async function getFollowUps(req, res) {
  const { search = "", status = "", type = "" } = req.query;

  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;

  let dbQuery = FollowUp.find(query).populate("client").sort({ dueDate: -1 });
  if (search) {
    dbQuery = FollowUp.find({
      ...query,
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { raisonParle: { $regex: search, $options: "i" } },
        { suivi: { $regex: search, $options: "i" } },
        { reponse: { $regex: search, $options: "i" } }
      ]
    })
      .populate("client")
      .sort({ dueDate: -1 });
  }

  const followUps = await dbQuery;
  return res.json(followUps);
}

export async function createFollowUp(req, res) {
  const followUp = await FollowUp.create(req.body);
  const populated = await followUp.populate("client");
  return res.status(201).json(populated);
}

export async function updateFollowUp(req, res) {
  const { id } = req.params;
  const followUp = await FollowUp.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true
  }).populate("client");

  if (!followUp) {
    return res.status(404).json({ message: "Suivi introuvable" });
  }
  return res.json(followUp);
}

export async function deleteFollowUp(req, res) {
  const { id } = req.params;
  const followUp = await FollowUp.findByIdAndDelete(id);
  if (!followUp) {
    return res.status(404).json({ message: "Suivi introuvable" });
  }
  return res.status(204).send();
}

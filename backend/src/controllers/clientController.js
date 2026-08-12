import mongoose from "mongoose";
import { Client } from "../models/Client.js";
import { Service } from "../models/Service.js";

const SERVICE_POPULATE = "code name designation category description price";

export async function getClients(req, res) {
  const { search = "", status = "" } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { contactName: { $regex: search, $options: "i" } },
      { clientType: { $regex: search, $options: "i" } },
      { activityCategories: { $regex: search, $options: "i" } }
    ];
  }
  if (status) {
    query.status = status;
  }

  const clients = await Client.find(query)
    .populate("service", SERVICE_POPULATE)
    .sort({ createdAt: -1 });
  return res.json(clients);
}

async function normalizeClientBody(body) {
  const data = { ...body };

  if (data.service === "" || data.service === undefined || data.service === null) {
    data.service = null;
    return data;
  }

  // Accepte un id string ou un objet { _id }
  const serviceId =
    typeof data.service === "object" && data.service !== null
      ? data.service._id || data.service
      : data.service;

  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    const err = new Error("Identifiant service invalide");
    err.status = 400;
    throw err;
  }

  const exists = await Service.exists({ _id: serviceId });
  if (!exists) {
    const err = new Error("Service introuvable dans la base");
    err.status = 400;
    throw err;
  }

  data.service = serviceId;
  return data;
}

export async function createClient(req, res) {
  try {
    const payload = await normalizeClientBody(req.body);
    const client = await Client.create(payload);
    await client.populate("service", SERVICE_POPULATE);
    return res.status(201).json(client);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    throw error;
  }
}

export async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const payload = await normalizeClientBody(req.body);
    const client = await Client.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    }).populate("service", SERVICE_POPULATE);

    if (!client) {
      return res.status(404).json({ message: "Client introuvable" });
    }

    return res.json(client);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    throw error;
  }
}

export async function deleteClient(req, res) {
  const { id } = req.params;
  const client = await Client.findByIdAndDelete(id);

  if (!client) {
    return res.status(404).json({ message: "Client introuvable" });
  }

  return res.status(204).send();
}


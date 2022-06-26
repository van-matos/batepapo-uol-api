import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from "joi";

const nameSchema = joi.object({
    name: joi.string().required()
});

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("message", "private_message").required()
});

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(()=> {
    db = mongoClient.db("batepapo-uol");
});

app.post("/participants", async (req, res) => {
    const validation = nameSchema.validate(req.body, { abortEarly: true });

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    const { name } = req.body; 

    const nameTaken = await db.collection('participants').findOne({ name });

    if (nameTaken) {
        res.sendStatus(409);
        return;
    }
    
    const participant = { name, lastStatus: Date.now()};

    const message = {from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss")};

    db.collection('participants').insertOne(participant);
    db.collection('messages').insertOne(message);
    res.sendStatus(201);
});

app.get("/participants", (req, res) => {
    const promise = db.collection('participants').find().toArray();
    promise.then(participants => res.send(participants));
});

app.post("/messages", async (req, res) => {
    const validation = messageSchema.validate(req.body, { abortEarly: true })

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    const { to, text, type } = req.body;
    const from = req.headers.user;

    const senderCheck = await db.collection('messages').find({ from: from }).toArray();

    if (!senderCheck) {
        res.sendStatus(422);
        return;
    }

    const message = {from, to, text, type, time: dayjs().format("HH:mm:ss")};

    db.collection('messages').insertOne(message);
    res.sendStatus(201);
})

app.get("/messages", async (req, res) => {
    const messageLimit = parseInt(req.query.limit);
    const user = req.headers.user;

    const messages = await db.collection('messages').find().toArray();
    const userMessages = messages.filter(message => message.from === user || message.to === user || message.to === "Todos");

    if (messageLimit) {
        res.send(userMessages.slice(-messageLimit));
    }

    res.send(userMessages);
});

app.post("/status", (req, res) => {
    const name = req.headers.user;
    const currentUser = db.collection('participants').find({name:name}).toArray();

    if (currentUser) {
        db.collection('participants').updateOne({name:name},{ $set:{lastStatus: Date.now()} });
        res.sendStatus(200);
    }else{
        res.sendStatus(404);
    }
})

app.listen(5000);
import express from 'express';
import cors from 'cors';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import joi from "joi";

const usernameSchema = joi.object({
    name: joi.string().required()
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
    const validation = usernameSchema.validate(req.body, { abortEarly: true });

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    const { username } = req.body; 

    const usernameTaken = await db.collection('participants').findOne({ username });

    if (usernameTaken) {
        res.sendStatus(409);
        return;
    }
    
    const participant = { username, lastStatus: Date.now()};

    const message = {from: username, to: 'Todos', text: 'entra na sala...', type: 'status', time: dayjs().format("HH:mm:ss")};

    db.collection('participants').insertOne(participant);
    db.collection('messages').insertOne(message);
    res.sendStatus(201);
});

app.listen(5000);
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
    const validation = nameSchema.validate(req.body);

    if (validation.error) {
        res.sendStatus(422);
        return;
    }

    const name = req.body.name;
    
    const nameTaken = await db.collection('participants').findOne({name: name});

    if (nameTaken) {
        res.sendStatus(409);
        return;
    }
    
    const user = {name: name, lastStatus: Date.now()};

    const message = {
        from: name,
        to: 'Todos',
        text: 'entra na sala...',
        type: 'status',
        time: dayjs().format("HH:mm:ss")};

    try {
        db.collection('participants').insertOne(user);
        db.collection('messages').insertOne(message);
        res.sendStatus(201);
    } catch (error) {
        response.status(500);
    }
});

app.get("/participants", async (req, res) => {

    try {
        const users = await db.collection('participants').find().toArray();
        res.send(users);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.post("/messages", async (req, res) => {
    const messageData = {
        from: req.headers.user,
        to: req.body.to,
        text: req.body.text,
        type: req.body.type
    };

    try {
        const messages = db.collection('messages');
        const users = await db.collection('participants').find().toArray();

        const validation = messageSchema.validate(req.body);

        if (validation.error || !req.headers.user || !users.some(user => user.name === req.headers.user)) {
            res.sendStatus(422);
            return;
        }

        await messages.insertOne({...messageData, time: dayjs().format('HH:mm:ss')});

        res.sendStatus(201);
    } catch (error) {
        res.status(500);
    }
})

app.get("/messages", async (req, res) => {
    const numMessages = parseInt(req.query.limit);
    const user = req.headers.user;

    try {
        const messages = await db.collection('messages').find().toArray();
        const userMessages = messages.filter(message => message.from === user || message.to === user || message.to === "Todos");

        if (numMessages) {
            res.send(userMessages.slice(-numMessages));
            return;
        }

        res.send(userMessages);
    } catch (error) {
        res.sendStatus(500);
    }
});

app.post("/status", async (req, res) => {
    const name = req.headers.user;

    try {
        const currentUser = db.collection('participants').find({name:name}).toArray();

        if (currentUser) {
            await db.collection('participants').updateOne({name:name},{ $set:{lastStatus: Date.now()} });
            res.sendStatus(200);
        }else{
            res.sendStatus(404);
        }
    } catch (error) {
        res.sendStatus(500);
    }
})

setInterval(removeInactiveUser, 15000)

async function removeInactiveUser() {
    const messages = db.collection('messages');
    const users = await db.collection('participants').find().toArray();

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (Date.now() - user.lastStatus > 10000) {
            await db.collection('participants').deleteOne({name: user.name});
            await messages.insertOne({
                from: user.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss'),
            });
        }
    }
}

app.listen(5000);
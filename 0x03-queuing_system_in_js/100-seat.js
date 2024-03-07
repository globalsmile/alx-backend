import express from 'express';
import { createQueue } from 'kue';
import { createClient } from 'redis';
import { promisify } from 'util';

const app = express();
const client = createClient();
const queue = createQueue();
const reserveSeat = (number) => {
    client.set('available_seats', number);
};
const getCurrentAvailableSeats = promisify(client.get).bind(client);
client.set('available_seats', 50);
let reservationEnabled = true;

app.get('/available_seats', async (req, res) => {
    const numberOfAvailableSeats = await getCurrentAvailableSeats('available_seats');
    res.json({ numberOfAvailableSeats });
}
);
app.get('/reserve_seat', async (req, res) => {
    if (!reservationEnabled) {
        res.json({ status: 'Reservation are blocked' });
    } else {
        queue.create('reserve_seat').save((err) => {
            if (err) {
                res.json({ status: 'Reservation failed' });
            } else {
                res.json({ status: 'Reservation in process' });
            }
        });
    }
}
);
app.get('/process', async (req, res) => {
    res.json({ status: 'Queue processing' });
    queue.process('reserve_seat', async (job, done) => {
        const availableSeats = await getCurrentAvailableSeats('available_seats');
        if (availableSeats > 0) {
            reserveSeat(availableSeats - 1);
            if (availableSeats - 1 === 0) {
                reservationEnabled = false;
            }
            done();
        } else {
            done(new Error('Not enough seats available'));
        }
    });
}
);

app.listen(1245);

export default app;

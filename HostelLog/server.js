const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'images')));
app.use(bodyParser.urlencoded({ extended: true }));

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'hostellog-440017-913cfcbd44ea.json'), 
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

//role selection page
app.get('/role', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'role_selection.html'));
});

//login page for students
app.get('/student-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student_login.html'));
});

//login page for parents
app.get('/parent-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'parent_login.html'));
});

//login page for authorities
app.get('/authority-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'authority_login.html'));
});

//login endpoint
app.post('/login', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '12ZRTP1f4AHawieMxvhmpzlY6j7mhAeARDJ22jAOqUVw', 
            range: 'Users!A:D',
        });

        const users = response.data.values;
        console.log('Fetched Users:', users);

        // Find a user that matches the provided username, password, and role
        const user = users.find(row => {
            console.log(`Checking row: ${row}`);
            console.log(`Role: ${row[1]}, Username: ${row[2]}, Password: ${row[3]}`);
            return row[1] === role && row[2] === username && row[3] === password;
        });
        
        if (user) {
            console.log('User found:', user);
            res.json({ status: 'success', user_id: user[0], role: user[1] });
        } else {
            console.log('Invalid credentials');
            res.json({ status: 'error', message: 'Invalid credentials' });
        }
    } catch (error) {
        // Handle any errors that occur during the API call
        console.error('Error fetching user data:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


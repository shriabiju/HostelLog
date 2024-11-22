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

const session = require('express-session');
const { createCanvas } = require('canvas'); // generates captcha image
const crypto = require('crypto');

app.use(
  session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: true,
  })
);

//generating random captcha image
function generateCaptchaText() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 6 })
    .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
    .join('');
}

// captcha generation endpoint
app.get('/generate-captcha', (req, res) => {
  const captchaText = generateCaptchaText();
  req.session.captcha = captchaText;

  // creating the captcha image
  const canvas = createCanvas(150, 50);
  const ctx = canvas.getContext('2d');

  //captcha styling
  ctx.fillStyle = '#e5effd';
  ctx.fillRect(0, 0, 150, 50);

  ctx.font = '30px Arial';
  ctx.fillStyle = '#333';
  ctx.fillText(captchaText, 20, 35);

  res.setHeader('Content-Type', 'image/png');
  canvas.createPNGStream().pipe(res);
});

//role selection page endpoint
app.get('/role', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'role_selection.html'));
});

//login page for students endpoint
app.get('/student-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student_login.html'));
});

//login page for parents endpoint
app.get('/parent-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'parent_login.html'));
});

//login page for authorities endpoint
app.get('/authority-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'authority_login.html'));
});

//login endpoint
app.post('/login', async (req, res) => {
    const { username, password, role, captcha } = req.body;

    //captcha validation
    if (req.session.captcha !== captcha) {
        return res.json({ status: 'error', message: 'Invalid CAPTCHA' });
      }

    //user authentication
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '12ZRTP1f4AHawieMxvhmpzlY6j7mhAeARDJ22jAOqUVw', 
            range: 'Users!A:D',
        });

        const users = response.data.values;
        console.log('Fetched Users:', users);

        // Finding a user that matches the username, password, and role
        const user = users.find(row => {
            console.log(`Checking row: ${row}`);
            console.log(`Role: ${row[1]}, Username: ${row[2]}, Password: ${row[3]}`);
            return row[1] === role && row[2] === username && row[3] === password;
        });
        
        //student profile endpoint
        app.get('/student-profile', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'student_profile.html'));
        });

        //authority profile endpoint
        app.get('/authority-profile', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'authority_profile.html'));
        });
        
        if (user) {
            console.log('User found:', user);
            if (role === 'student') {
                return res.redirect('/student-profile');
            } else if (role === 'authority') {
                    return res.redirect('/authority-profile');
            } else {
                return res.json({ status: 'error', message: 'Role not supported' });
            }
        } else {
            console.log('Invalid credentials');
            res.json({ status: 'error', message: 'Invalid credentials' });
        }
    }
    
    catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

 //parent profile endpoint
 app.get('/parent-profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'parent_profile.html'));
});

app.post('/parent-login', async (req, res) => {
    const { reg_no, dob, parent_email } = req.body;

    console.log('Request Body:', req.body); 

    if (!reg_no || !dob || !parent_email) {
        return res.json({ status: 'error', message: 'All fields are required' });
    }
    
    try {
        const studentResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: '12ZRTP1f4AHawieMxvhmpzlY6j7mhAeARDJ22jAOqUVw',
            range: 'Students!A:D',
        });
        const parentResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: '12ZRTP1f4AHawieMxvhmpzlY6j7mhAeARDJ22jAOqUVw',
            range: 'Parents!A:D',
        });

        const students = studentResponse.data.values || [];
        const parents = parentResponse.data.values || [];

        console.log('Fetched Students:', students); 
        console.log('Fetched Parents:', parents); 
        const student = students.find(row => row[1] === reg_no && row[3] === dob);
        const parent = parents.find(row => row[3] === reg_no && row[2] === parent_email);

        console.log('Matched Student:', student);
        console.log('Matched Parent:', parent);

        if (student && parent) {
            console.log('Parent login successful for:', parent);
            return res.redirect('/parent-profile');
        } else {
            console.log('Invalid Parent Login');
            return res.json({ status: 'error', message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

//for fetching the personal_info from database
app.get('/get-personal-info', async (req, res) => {
    const { username } = req.query; 
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: '12ZRTP1f4AHawieMxvhmpzlY6j7mhAeARDJ22jAOqUVw',
            range: 'PersonalInfo!A:O', 
        });

        const data = response.data.values;
        const userInfo = data.find(row => row[0] === username); 
        if (userInfo) {
            res.json({ status: 'success', data: userInfo });
        } else {
            res.json({ status: 'error', message: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching personal info:', error);
        res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
});

//side bar endpoint (student profile)
app.get('/sidebar-student', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sidebar_student.html'));
});

//mess menu viewing endpoint (student profile)
app.get('/mess-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mess_menu.html'));
});

//room cleaning viewing endpoint (student profile)
app.get('/room-cleaning', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'room_cleaning.html'));
});

//student attendance viewing endpoint (student profile)
app.get('/student-attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student_attendance.html'));
});

//noticeboard viewing endpoint (student profile)
app.get('/notice-board', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'notice_board.html'));
});

//personal info viewing endpoint (student profile)
app.get('/personal-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'personal_info.html'));
});

//hostel details viewing endpoint (student profile)
app.get('/hostel-details', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hostel_details.html'));
});

//family info viewing endpoint (student profile)
app.get('/family-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'family_info.html'));
});

//educational info viewing endpoint (student profile)
app.get('/educational-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'educational_info.html'));
});

//proctor info viewing endpoint (student profile)
app.get('/proctor-info', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'proctor_info.html'));
});

//social media endpoint (student profile)
app.get('/social-media', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'social_media.html'));
});

//social media endpoint (parents' profile)
app.get('/p-social-media', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_social_media.html'));
});

//complaints endpoint (parents' profile)
app.get('/p-complaints', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_complaints.html'));
});

//room cleaning endpoint (parents' profile)
app.get('/p-room-cleaning', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_room_cleaning.html'));
});

//noticeboard endpoint (parents' profile)
app.get('/p-notice-board', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_notice_board.html'));
});

//sidebar endpoint (parents' profile)
app.get('/p-sidebar', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_sidebar.html'));
});

//mess menu endpoint (parents' profile)
app.get('/p-mess-menu', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_mess_menu.html'));
});

//contact endpoint (parents' profile)
app.get('/p-contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_contact.html'));
});

//attendance endpoint (parents' profile)
app.get('/p-attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'p_attendance.html'));
});

// Starting the server on the specified port
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});


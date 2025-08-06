This is the backend API for the E-Learning Platform web application.  
Built with Node.js, Express.js, and MySQL.

## Prerequisites

- Node.js (v14 or above recommended)
- MySQL installed locally or access to a remote MySQL database

## Installation

1. Clone the repository:

git clone https://github.com/GraceMonde/E-Learning-Platform
cd E-Learning-Platform/backend

2. Install dependencies:

npm install

3. Create a `.env` file:

Copy the example environment file and update with your own credentials:

4. Configure your `.env` file:

Open `.env` and fill in your database credentials and JWT secret.

## Example .env

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=elearning_platform

JWT_SECRET=d4a4f5dcf23b1d6dfc4b37f57d445fc2fb28a2ba55ac52dcc564777e108689b1

PORT=5000

## Project File Structure

```
backend/
├── config/
│   └── db.js              # MySQL connection setup
├── routes/
│   ├── user.js            # User registration and listing
│   ├── auth.js            # Authentication (login)
│   └── profile.js         # User profile (protected)
├── E-LearningDB.sql.sql   # Database schema
├── server.js              # Main Express server
├── package.json           # Node.js dependencies
├── package-lock.json      # Dependency lock file
└── README.md              # Project documentation
```

## Running the Server

Start the development server with:

npm run dev

The server will start on `http://localhost:5000` (or the port you set in `.env`).

## Profile Endpoints

Authenticated users can manage their profile using the following routes:

- `GET /api/profile` – retrieve the current user's profile information.
- `PUT /api/profile` – update name and/or email of the current user.
- `PUT /api/profile/password` – change the password after providing the current one.


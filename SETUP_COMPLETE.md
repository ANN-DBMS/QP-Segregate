# Setup Complete! 🎉

Your QPaper AI backend is now configured with cloud databases. Here's what has been set up:

## ✅ What's Done

1. **Supabase PostgreSQL** - Connected and tested
2. **Backend Configuration** - Updated to use cloud databases
3. **Test Scripts** - Created for connection testing
4. **Database Initialization** - Script ready to create tables and admin user
5. **Storage Directories** - Created for file uploads

## 📁 Files Created/Updated

### Backend Files
- `backend/.env` - Environment configuration (you need to create this manually - see below)
- `backend/test_connections.py` - Test all database connections
- `backend/init_db.py` - Initialize database schema and create admin user
- `backend/README_SETUP.md` - Setup documentation
- `backend/app/core/config.py` - Updated to read from .env file

### Test Files
- `test_supabase.py` - Quick Supabase connection test

### Storage Directories
- `backend/storage/papers/` - For uploaded PDFs
- `backend/storage/page_images/` - For extracted page images
- `backend/tmp/uploads/` - For temporary uploads

## 🚀 Next Steps

### 1. Create backend/.env File

Since `.env` files are protected, you need to create it manually:

```powershell
cd backend
copy env.example .env
```

Then edit `backend/.env` and update with your Supabase connection:

```env
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

```

### 2. Activate Virtual Environment

```powershell
cd backend
.\venv\Scripts\Activate.ps1
```

### 3. Test Database Connection

```powershell
python test_connections.py
```

### 4. Initialize Database

```powershell
python init_db.py
```

This will:
- Create all database tables
- Create admin user (username: `admin`, password: `admin123`)
- Create sample courses

### 5. Set Up MongoDB Atlas (Optional but Recommended)

1. Go to https://cloud.mongodb.com
2. Create free cluster
3. Create database user
4. Allow network access (0.0.0.0/0)
5. Get connection string
6. Add to `backend/.env`:
   ```env
   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/qpaper_ai?retryWrites=true&w=majority
   ```

### 6. Set Up Redis Cloud (Optional but Recommended)

1. Go to https://redis.com/redis-enterprise-cloud/
2. Create free database
3. Get connection string
4. Add to `backend/.env`:
   ```env
   REDIS_URL=redis://username:password@your-redis-endpoint:port
   ```

### 7. Run Backend

```powershell
# Terminal 1 - Backend API
uvicorn app.main:app --reload

# Terminal 2 - Celery Worker (for background tasks)
celery -A app.tasks.celery worker --loglevel=info
```

## 🧪 Testing

### Test Supabase Connection
```powershell
python ..\test_supabase.py
```

### Test All Connections
```powershell
python test_connections.py
```

### Test Backend API
```powershell
# Start backend
uvicorn app.main:app --reload

# In another terminal, test health endpoint
curl http://localhost:8000/health
```

## 📝 Important Notes

1. **Virtual Environment**: Always activate before running Python commands:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

2. **Environment Variables**: The `.env` file must be in the `backend/` directory

3. **Admin Credentials**: Default admin password is `admin123` - change it after first login!

4. **MongoDB & Redis**: These are optional but recommended for full functionality

## 🔧 Troubleshooting

### "Module not found" errors
- Activate virtual environment: `.\venv\Scripts\Activate.ps1`
- Install dependencies: `pip install -r requirements.txt`

### Database connection fails
- Check `backend/.env` file exists and has correct `DATABASE_URL`
- Verify Supabase project is active
- Test with: `python test_connections.py`

### Can't find .env file
- Create it manually: `copy env.example .env`
- Edit with your connection strings

## 📚 Documentation

- `backend/README_SETUP.md` - Detailed setup guide
- `SETUP_GUIDE.md` - General setup instructions
- `CLOUD_SETUP.md` - Cloud database setup guide

## ✨ You're Ready!

Your backend is configured and ready to use. Once you:
1. Create the `.env` file
2. Initialize the database
3. Set up MongoDB and Redis (optional)

You can start running your application!


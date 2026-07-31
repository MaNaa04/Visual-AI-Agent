# Over-Engineered Components (Can Be Deferred to Version 2) 

The following components are **not bad engineering practices** , but they introduce additional complexity without directly contributing to the assignment’s core objective of capturing browser activity, processing it using AI, and storing it in a database. 

- # Component Why it’s Over-Engineered / Not a Good Fit 

- 1 **PostgreSQL +** Semantic search isn’t part of the assignment. MongoDB (or plain **pgvector** PostgreSQL) is sufficient until retrieval becomes a requirement. 

- 2 **Embedding** Completely outside the current scope. It’s a portfolio **Pipeline** enhancement, not an MVP feature. **(Phase 13)** 

- 3 **Retrieval API** The assignment only mentions storing data, not querying or **(Phase 7)** searching it. Can be added later if needed. 

- 4 **Dashboard /** Nice for demonstrations, but not required for fulfilling the 

- **Timeline UI** assignment objective. **(Phase 8)** 

- 5 **Server-Sent** Adds complexity without solving any stated problem. Static **Events (Live** storage is enough for the MVP. **Activity Stream)** 

- 6 **Audit Logging** Useful in enterprise/compliance systems, but unnecessary for a personal monitoring tool. 

- 7 **API Key** Secure token authentication is enough. Rotation introduces **Rotation** operational complexity without much benefit here. 

- 8 **Encryption at** Database-level or disk encryption can be deferred. Mentioning it is **Rest** fine, implementing it isn’t essential for the MVP. 

- 9 **Data Export /** Valuable for a real product, but outside the assignment’s core **Delete** requirements. **System** 

- 10 **Retention Job** Unless screenshots are expected to grow indefinitely, automatic cleanup can wait until later versions. 

- 11 **GitHub** Helpful for professional development, but reviewers usually care **Actions** more about a working project than CI pipelines. **(CI/CD)** 

- 12 **Docker from** Local development is faster without Docker initially. Containerize **Day One** once the application is stable. 

- 13 **Dead Letter** Excellent production practice, but simple retry logic is sufficient 

# Component Why it’s Over-Engineered / Not a Good Fit 

   - **Queue (DLQ)** for an MVP. 

- 14 **Backpressure** Personal browser extensions won’t generate traffic high enough to **& Advanced** justify this complexity. **Rate Limiting** 

- 15 **Perceptual** Perceptual hashing is an excellent optimization and should stay. **Hash + Redis** Redis caching for repeated classifications can be postponed until 

- **Cache** API cost actually becomes an issue. **Together** 

- 16 **OCR-based** Strong privacy feature, but significantly increases implementation 

- **PII Redaction** effort. An exclude-list for sensitive websites provides most of the benefit for the MVP. 

- 17 **Sessions** Unless you’re explicitly analyzing browsing sessions, storing **Table** individual activity events is enough. 

- 18 **Tags Table** AI-generated tags can simply be stored as an array inside the activity document instead of introducing another relational table. 

- 19 **Structured** Simple application logs are sufficient. Full observability is 

- **Monitoring /** unnecessary for a take-home assignment. **Observability Stack** 

- 20 **One Week of** Great product practice, but unrealistic for a hiring assignment with **Dogfooding** limited time. A few days of manual testing is sufficient. 

# Components Worth Keeping in the MVP 

These features provide significant value while keeping the implementation practical and aligned with the assignment. 

- ✅ Manifest V3 + React + TypeScript 

- ✅ FastAPI Backend 

- ✅ Gemini Vision Integration 

- ✅ Event Batching 

- ✅ Background Worker (Redis Queue / RQ / Celery) 

- ✅ Screenshot Deduplication using Perceptual Hashing 

- ✅ Exclude-list for Sensitive Websites 

- ✅ Pause / Resume Monitoring 

- ✅ Image Compression Before Upload 

- ✅ Retry Mechanism for Failed AI Calls 

- ✅ Clean API Contracts 

 ✅ Docker (Only Before Deployment, Not During Initial Development) 

# Ideal MVP Roadmap 

If the roadmap is simplified to focus purely on delivering the assignment successfully, the implementation should contain only the following phases: 

1. Project Setup 

2. Chrome Extension (Capture Layer) 

3. Backend API 

4. AI Vision Pipeline 

5. Data Storage 

6. Basic Security & Privacy 

7. Testing 

8. Deployment 

Everything else can be treated as **Version 2** or **Portfolio Enhancements** after the core system is complete. This approach significantly increases the chances of delivering a polished, fully functional MVP within the available time while still demonstrating strong software engineering practices. 


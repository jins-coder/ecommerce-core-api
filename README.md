# E-Commerce Core API Service

Production-ready TypeScript REST API backend for e-commerce catalog, order processing, and inventory management.

## 🚀 Features
- **Authentication**: JWT-based authentication with role-based access control.
- **Product Catalog**: High-throughput catalog endpoints with category and tag indexing.
- **Order Processing**: Multi-item checkout pipeline with pricing validation.
- **Inventory Service**: Stock tracking and reservation workflows.

## 🛠️ Tech Stack
- **Runtime**: Node.js (v20+)
- **Language**: TypeScript (Strict mode)
- **Framework**: Express.js
- **Validation**: Zod
- **Testing**: Vitest

## 📦 Setup & Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run unit tests
npm test

# Build production bundle
npm run build
```

## 🏗️ Architecture

```
src/
├── controllers/     # HTTP Request handlers & routing
├── middleware/      # Authentication & validation middleware
├── models/          # Data schemas and entities
├── services/        # Core business logic (Orders, Inventory, Auth)
├── utils/           # Database mock, error classes, helpers
└── index.ts         # App initialization & server entry
```

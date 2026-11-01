# Database Architecture & Management

This directory contains schemas, migrations, seed data, and connection utilities for the dual-database architecture:

## 1. MySQL 8 (Transactional Source of Truth)
- Primary relational database (`restaurant_inventory_db`).
- Authoritative store for:
  - Customers & Orders
  - Menu Items & Recipes (BOM - Bill of Materials)
  - Suppliers & Purchase Orders
  - Inventory Lots, Stock Levels & Transactions

## 2. MongoDB (Operational & Flexible Records)
- NoSQL database (`restaurant_inventory_logs`).
- Dedicated store for:
  - System and operational audit logs
  - User activity & authentication events
  - Notification history & alerts
  - Demand prediction execution runs & model inference metadata

> **Architectural Rule**: Do not duplicate authoritative transactional data between MySQL and MongoDB.

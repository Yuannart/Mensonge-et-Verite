# Overview

This is a real-time multiplayer card game application built with React and Express.js. The game appears to be a social deduction game involving truth and lie cards, where players can accuse each other and reveal cards. The application features a modern web interface with real-time communication via WebSockets and uses a PostgreSQL database for data persistence.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **React SPA**: Built with Vite as the build tool and development server
- **UI Components**: Uses shadcn/ui component library with Radix UI primitives for accessible components
- **Styling**: TailwindCSS for utility-first styling with custom CSS variables for theming
- **Routing**: Client-side routing with wouter library for lightweight navigation
- **State Management**: React Query for server state management and caching
- **Real-time Communication**: WebSocket connection with custom hook for game state synchronization

## Backend Architecture
- **Express.js Server**: RESTful API with WebSocket support for real-time features
- **In-Memory Storage**: Currently uses a memory-based storage system with an interface that can be swapped for database implementations
- **WebSocket Server**: Handles real-time game events, player connections, and state broadcasting
- **Middleware**: Custom logging middleware for API requests and error handling

## Data Storage
- **Database Schema**: Drizzle ORM with PostgreSQL dialect configured
- **Schema Definition**: Shared schema between client and server with Zod validation
- **Game State**: In-memory storage with interface abstraction for future database migration
- **Session Management**: Prepared for PostgreSQL session storage with connect-pg-simple

## Authentication & Game Logic
- **Player Management**: UUID-based player identification stored in localStorage
- **Game Phases**: Multi-phase game system (waiting, playing, accusation, revelation, finished)
- **Card System**: Truth/lie card mechanics with player accusations and revelations
- **Real-time Sync**: WebSocket-based state synchronization across all connected players

## Development & Deployment
- **Development**: Vite dev server with HMR and Express backend proxy
- **Build Process**: Vite for client build, esbuild for server bundling
- **Type Safety**: Full TypeScript implementation across client, server, and shared code
- **Code Organization**: Monorepo structure with shared schemas and types

# External Dependencies

## Database & ORM
- **PostgreSQL**: Primary database (configured via Drizzle but using in-memory storage currently)
- **Drizzle ORM**: Database toolkit with migrations support
- **Neon Database**: Serverless PostgreSQL connection driver

## UI & Frontend Libraries
- **Radix UI**: Headless component primitives for accessibility
- **shadcn/ui**: Pre-built component library with consistent design system
- **TailwindCSS**: Utility-first CSS framework
- **Lucide React**: Icon library for UI elements
- **React Query**: Server state management and caching
- **date-fns**: Date formatting and manipulation

## Real-time & Networking
- **WebSocket (ws)**: WebSocket server implementation for real-time communication
- **Custom WebSocket Hook**: Client-side WebSocket management with reconnection logic

## Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Static type checking across the entire application
- **ESBuild**: Fast JavaScript/TypeScript bundler for server code
- **Replit Integration**: Development environment optimizations for Replit platform
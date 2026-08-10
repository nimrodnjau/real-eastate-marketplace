# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Development Setup

## Windows Users (Most of the team)
1. Clone the repo
2. Run `npm install`
3. Run `npm run dev`
4. Open `http://localhost:5173`

## WSL2 Users (Linux on Windows)
1. Clone the repo in WSL2
2. Run `npm install`
3. Run `npm run dev:wsl`
4. Open `http://localhost:5173` from Windows browser

If you get connection errors:
- Run `ip addr show eth0 | grep inet` to get your WSL2 IP
- Access via `http://<wsl-ip>:5173`

## Development for WSL2 Users
If you're using WSL2:
1. Get your WSL2 IP: `ip addr show eth0 | grep inet`
2. Run: `npm run dev:wsl` 
3. Access via: `http://<your-wsl-ip>:5173` from Windows browser
4. For hot-reload to work, update HMR host in your config

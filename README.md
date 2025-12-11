# RouteVision 🌐

> **Network Topology & Routing Management System**
> *Final Project for IT-3104 Web Systems and Technologies*

![Project Status](https://img.shields.io/badge/Status-Operational-success)
![Version](https://img.shields.io/badge/Version-1.0-blue)

## 📖 About The Project

**RouteVision** is an advanced, browser-based network simulation tool designed to simplify the complex process of network design and analysis. It allows network engineers and students to construct virtual networks, define device parameters, establish connections, and critically, execute **routing simulations**.

The platform utilizes a reactive, component-based structure to ensure the visualization updates dynamically. The "techy" design, featuring neon accents and dark interfaces, is specifically chosen to reduce eye strain and enhance the feel of high-fidelity, professional network management.

## ✨ Key Features

*   **Interactive Topology Designer:** Drag-and-drop interface using **GoJS** to place routers, switches, PCs, and servers.
*   **Device Configuration:** Double-click devices to set IP addresses, Subnet Masks, and Default Gateways.
*   **Static Routing Simulation:** Configure routing tables on routers and simulate how packets travel through the network.
*   **Visual Traceroute:** Watch packets animate across the links with real-time feedback on success or failure (TTL, No Route, etc.).
*   **Real-Time Traffic Mode:** Simulate multiple packet flows simultaneously to stress-test the network.
*   **Cloud Persistence:** Save and Load network topologies instantly using **Firebase Firestore**.
*   **User Authentication:** Secure login and registration via Email/Password or Google Auth.

## 🛠️ Technologies Used

This project was built using the following technologies:

*   **Frontend:** HTML5, CSS3 (Custom Neon UI), JavaScript (ES6+ Modules)
*   **Diagramming Engine:** [GoJS Library](https://gojs.net/)
*   **Backend / Database:** Firebase Firestore
*   **Authentication:** Firebase Auth
*   **Icons:** FontAwesome 6
*   **Fonts:** Inter (Google Fonts)

## 👥 The Engineering Team

| Name | Role |
| :--- | :--- |
| **John Kenneth Alarde** | UI Designer & Programmer |
| **Carl Gian Castillo** | Frontend Dev & Programmer |
| **Mark Denver Garcia** | Lead Frontend & Dev |
| **Jigger Gayares** | Backend Dev & Programmer |
| **John Rick Magtibay** | Database Manager & Dev |

## 🚀 How to Run

1.  Clone the repository:
    ```bash
    git clone https://github.com/kennethalarde23/RouteVision.git
    ```
2.  Open the folder in VS Code.
3.  Because the project uses ES6 Modules (`import`/`export`), you must run it using a local server.
    *   **Recommended:** Use the "Live Server" extension in VS Code.
    *   Right-click `index.html` and select **"Open with Live Server"**.

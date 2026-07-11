\# courier-route-optimizer



I work a part-time job as a delivery driver while finishing my Computer Science degree. Every day I face the same problem: 30-50 packages, and some clients can only receive them at certain time intervals. Choosing the delivery order by hand is basically guessing, and a bad order means wasted time and wasted fuel.



This project is my bachelor's thesis: a web application that computes the optimal delivery route for a courier's day, taking time windows into account (the VRPTW problem). The optimized routes are compared against my real delivery data, the order I actually drove, recorded day by day, against other, simpler, methods (nearest-neighbor, 2-opt).



\## Stack



\- \*\*Solver\*\*: Python, FastAPI, Google OR-Tools

\- \*\*Travel times\*\*: OSRM (self-hosted, Docker)

\- \*\*Backend\*\*: Node.js, TypeScript, Express, PostgreSQL

\- \*\*Frontend\*\*: React, TypeScript, Tailwind



\## Status



Bachelor's thesis, in development (July–September 2026).


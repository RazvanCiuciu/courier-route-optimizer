**OSRM - rulare locala**

## Setup (o singura data, sau dupa update de harta)

docker pull ghcr.io/project-osrm/osrm-backend
## descarca romania-*.osm.pbf de pe download.geofabrik.de/europe/romania.html in solver/osrm-data/

docker run -t -v "<path-absolut>\solver\osrm-data:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/romania-*.osm.pbf
docker run -t -v "<path-absolut>\solver\osrm-data:/data" ghcr.io/project-osrm/osrm-backend osrm-partition /data/romania-*.osrm
docker run -t -v "<path-absolut>\solver\osrm-data:/data" ghcr.io/project-osrm/osrm-backend osrm-customize /data/romania-*.osrm

## Pornire server (de fiecare data cand lucrezi)
docker run -t -i -p 5000:5000 -v "<path-absolut>\solver\osrm-data:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/romania-*.osrm

## Test
http://localhost:5000/table/v1/driving/lon1,lat1;lon2,lat2
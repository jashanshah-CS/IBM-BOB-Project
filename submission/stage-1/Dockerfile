FROM node:20-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY TestForge/package*.json ./TestForge/
RUN cd TestForge && npm ci

COPY TestForge ./TestForge
RUN cd TestForge \
    && npm run build \
    && npm prune --omit=dev

COPY Dashboard ./Dashboard
RUN python3 -m venv /opt/testforge-venv \
    && /opt/testforge-venv/bin/pip install --no-cache-dir -r Dashboard/requirements.txt

COPY submission/stage-1/start.sh ./start.sh
RUN chmod +x ./start.sh

ENV TESTFORGE_API_URL=http://127.0.0.1:3000
ENV PATH=/opt/testforge-venv/bin:$PATH

EXPOSE 3000 8501

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["/bin/sh", "/app/start.sh"]


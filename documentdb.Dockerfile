FROM ubuntu:22.04
ARG PG_VERSION=16

ENV PG_VERSION=${PG_VERSION}

# Install build essentials and PostgreSQL
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -qy \
    wget \
    curl \
    sudo \
    gnupg2 \
    lsb-release \
    tzdata \
    build-essential \
    pkg-config \
    git \
    && sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list' \
    && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add - \
    && apt-get update \
    && apt-get install -qy \
    postgresql-${PG_VERSION} \
    postgresql-server-dev-${PG_VERSION} \
    postgresql-${PG_VERSION}-pgvector \
    && apt-get clean

# Clone and build DocumentDB
WORKDIR /opt
RUN git clone https://github.com/microsoft/documentdb.git
WORKDIR /opt/documentdb
RUN make && make install

# Configure PostgreSQL for DocumentDB
RUN echo "shared_preload_libraries = 'pg_documentdb_core'" >> /etc/postgresql/${PG_VERSION}/main/postgresql.conf \
    && echo "documentdb.initializeSharedMemory = true" >> /etc/postgresql/${PG_VERSION}/main/postgresql.conf

# Expose PostgreSQL port
EXPOSE 5432

# Start script
CMD service postgresql start && tail -f /var/log/postgresql/postgresql-${PG_VERSION}-main.log
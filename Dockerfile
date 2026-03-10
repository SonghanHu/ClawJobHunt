FROM ghcr.io/openclaw/openclaw:latest

USER root

# System packages + GitHub CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    jq \
    ffmpeg \
    git \
    sudo \
    build-essential \
    procps \
    file \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y --no-install-recommends gh \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Go
RUN curl -fsSL https://go.dev/dl/go1.24.1.linux-$(dpkg --print-architecture).tar.gz \
    | tar -C /usr/local -xz
ENV PATH="/usr/local/go/bin:${PATH}"

# Homebrew (as node user)
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/node

USER node
ENV PATH="/home/node/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/bin:${PATH}"
RUN NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    && brew install gogcli

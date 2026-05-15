FROM ubuntu:24.04

# ターゲット: Linux ネイティブシミュレーション (Verilator + g++)
# WebAssembly / Pico SDK / OpenOCD は含まない

ARG USER_UID=1000
ARG USER_GID=1000

RUN DEBIAN_FRONTEND=noninteractive apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates git \
        build-essential cmake ninja-build pkg-config \
        autoconf automake libtool texinfo \
        flex bison libfl-dev help2man perl perl-doc \
        python3 python3-dev python3-pip \
        passwd \
        ccache \
    && rm -rf /var/lib/apt/lists/*

ARG COCOTB_VERSION=2.0.0
RUN pip3 install --no-cache-dir --break-system-packages \
        cocotb==${COCOTB_VERSION} pytest

ARG VERILATOR_TAG=v5.048
RUN git clone --branch ${VERILATOR_TAG} --depth 1 \
        https://github.com/verilator/verilator.git /tmp/verilator \
    && cd /tmp/verilator \
    && autoconf \
    && ./configure --prefix=/usr/local \
    && make -j"$(nproc)" \
    && make install \
    && cd / && rm -rf /tmp/verilator

ENV VERILATOR_ROOT=/usr/local/share/verilator \
    CCACHE_DIR=/ccache \
    PATH=/usr/lib/ccache:/usr/local/bin:/usr/bin:/bin

RUN if ! getent group ${USER_GID} >/dev/null; then groupadd -g ${USER_GID} dev; fi \
    && if ! id -u ${USER_UID} >/dev/null 2>&1; then \
         useradd -m -u ${USER_UID} -g ${USER_GID} -s /bin/bash dev; \
       fi \
    && mkdir -p /ccache && chown -R ${USER_UID}:${USER_GID} /ccache

USER ${USER_UID}:${USER_GID}
WORKDIR /work
CMD ["bash"]

#!/bin/bash

export ANDROID_NDK_VERSION=r19c
export ANDROID_SDK_VERSION=r29.0.0
export ANDROID_SDK_TOOLS_VERSION=4333796

export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
export ANDROID_SDK_ROOT=/usr/lib/android-sdk
export ANDROID_SDK_TOOLS_ROOT=${ANDROID_SDK_ROOT}/build-tools

export PATH=${ANDROID_SDK_TOOLS_ROOT}/tools/bin:$PATH

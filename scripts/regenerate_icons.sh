#!/bin/bash

# 源文件
SOURCE_ICON="public/topoo-icon.png"
ICONSET_DIR="src-tauri/icons/icon.iconset"
ICNS_FILE="src-tauri/icons/icon.icns"

# 检查源文件是否存在
if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon $SOURCE_ICON not found"
    exit 1
fi

echo "Cleaning up..."
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# 1. 创建一个带Padding的主图标 (Master Icon)
# macOS图标通常有约10%-20%的padding
# 目标是1024x1024，内容我们设为约820x820 (约80%)
echo "Creating padded master icon..."

# 第一步：将源图标调整为 820x820 (内容尺寸)
sips -Z 820 "$SOURCE_ICON" --out "$ICONSET_DIR/temp_content.png"

# 第二步：将画布扩展到 1024x1024 (添加透明边框)
# sips --padToHeightWidth 1024 1024 默认居中并填充透明(对于png)
sips --padToHeightWidth 1024 1024 "$ICONSET_DIR/temp_content.png" --out "$ICONSET_DIR/icon_512x512@2x.png"

# 2. 基于这个带padding的主图标生成其他尺寸
MASTER="$ICONSET_DIR/icon_512x512@2x.png"

echo "Generating other sizes..."
sips -z 16 16     "$MASTER" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32     "$MASTER" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32     "$MASTER" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64     "$MASTER" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128   "$MASTER" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256   "$MASTER" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256   "$MASTER" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512   "$MASTER" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512   "$MASTER" --out "$ICONSET_DIR/icon_512x512.png"

# 清理临时文件
rm "$ICONSET_DIR/temp_content.png"

# 3. 生成 .icns 文件
echo "Creating .icns file..."
iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"

echo "Done! Icon regenerated at $ICNS_FILE"

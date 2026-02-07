use base64::Engine;

/// Protobuf Varint Encoding
pub fn encode_varint(mut value: u64) -> Vec<u8> {
    let mut buf = Vec::new();
    while value >= 0x80 {
        buf.push((value & 0x7F | 0x80) as u8);
        value >>= 7;
    }
    buf.push(value as u8);
    buf
}

/// Read Protobuf Varint
pub fn read_varint(data: &[u8], offset: usize) -> Result<(u64, usize), String> {
    let mut result = 0u64;
    let mut shift = 0;
    let mut pos = offset;

    loop {
        if pos >= data.len() {
            return Err("incomplete_data".to_string());
        }
        let byte = data[pos];
        result |= ((byte & 0x7F) as u64) << shift;
        pos += 1;
        if byte & 0x80 == 0 {
            break;
        }
        shift += 7;
    }

    Ok((result, pos))
}

/// Skip Protobuf Field
pub fn skip_field(data: &[u8], offset: usize, wire_type: u8) -> Result<usize, String> {
    match wire_type {
        0 => {
            // Varint
            let (_, new_offset) = read_varint(data, offset)?;
            Ok(new_offset)
        }
        1 => {
            // 64-bit
            Ok(offset + 8)
        }
        2 => {
            // Length-delimited
            let (length, content_offset) = read_varint(data, offset)?;
            Ok(content_offset + length as usize)
        }
        5 => {
            // 32-bit
            Ok(offset + 4)
        }
        _ => Err(format!("unknown_wire_type: {}", wire_type)),
    }
}

/// Remove specified Protobuf field
pub fn remove_field(data: &[u8], field_num: u32) -> Result<Vec<u8>, String> {
    let mut result = Vec::new();
    let mut offset = 0;

    while offset < data.len() {
        let start_offset = offset;
        let (tag, new_offset) = read_varint(data, offset)?;
        let wire_type = (tag & 7) as u8;
        let current_field = (tag >> 3) as u32;

        if current_field == field_num {
            // Skip this field
            offset = skip_field(data, new_offset, wire_type)?;
        } else {
            // Keep other fields
            let next_offset = skip_field(data, new_offset, wire_type)?;
            result.extend_from_slice(&data[start_offset..next_offset]);
            offset = next_offset;
        }
    }

    Ok(result)
}

/// Find specified Protobuf field content (Length-Delimited only)
pub fn find_field(data: &[u8], target_field: u32) -> Result<Option<Vec<u8>>, String> {
    let mut offset = 0;

    while offset < data.len() {
        let (tag, new_offset) = match read_varint(data, offset) {
            Ok(v) => v,
            Err(_) => break, // Incomplete data, stop
        };

        let wire_type = (tag & 7) as u8;
        let field_num = (tag >> 3) as u32;

        if field_num == target_field && wire_type == 2 {
            let (length, content_offset) = read_varint(data, new_offset)?;
            return Ok(Some(
                data[content_offset..content_offset + length as usize].to_vec(),
            ));
        }

        // Skip field
        offset = skip_field(data, new_offset, wire_type)?;
    }

    Ok(None)
}

/// Create OAuthTokenInfo (Field 6)
///
/// Structure:
/// message OAuthTokenInfo {
///     optional string access_token = 1;
///     optional string token_type = 2;
///     optional string refresh_token = 3;
///     optional Timestamp expiry = 4;
/// }
pub fn create_oauth_field(access_token: &str, refresh_token: &str, expiry: i64) -> Vec<u8> {
    // Field 1: access_token (string, wire_type = 2)
    let tag1 = (1 << 3) | 2;
    let field1 = {
        let mut f = encode_varint(tag1);
        f.extend(encode_varint(access_token.len() as u64));
        f.extend(access_token.as_bytes());
        f
    };

    // Field 2: token_type (string, fixed value "Bearer", wire_type = 2)
    let tag2 = (2 << 3) | 2;
    let token_type = "Bearer";
    let field2 = {
        let mut f = encode_varint(tag2);
        f.extend(encode_varint(token_type.len() as u64));
        f.extend(token_type.as_bytes());
        f
    };

    // Field 3: refresh_token (string, wire_type = 2)
    let tag3 = (3 << 3) | 2;
    let field3 = {
        let mut f = encode_varint(tag3);
        f.extend(encode_varint(refresh_token.len() as u64));
        f.extend(refresh_token.as_bytes());
        f
    };

    // Field 4: expiry (Nested Timestamp message, wire_type = 2)
    // Timestamp message contains: Field 1: seconds (int64, wire_type = 0)
    let timestamp_tag = (1 << 3) | 0; // Field 1, varint
    let timestamp_msg = {
        let mut m = encode_varint(timestamp_tag);
        m.extend(encode_varint(expiry as u64));
        m
    };

    let tag4 = (4 << 3) | 2; // Field 4, length-delimited
    let field4 = {
        let mut f = encode_varint(tag4);
        f.extend(encode_varint(timestamp_msg.len() as u64));
        f.extend(timestamp_msg);
        f
    };

    // Merge all fields into OAuthTokenInfo message
    let oauth_info = [field1, field2, field3, field4].concat();

    // Wrap as Field 6 (length-delimited)
    let tag6 = (6 << 3) | 2;
    let mut field6 = encode_varint(tag6);
    field6.extend(encode_varint(oauth_info.len() as u64));
    field6.extend(oauth_info);

    field6
}

/// Create Email (Field 2)
pub fn create_email_field(email: &str) -> Vec<u8> {
    let tag = (2 << 3) | 2;
    let mut f = encode_varint(tag);
    f.extend(encode_varint(email.len() as u64));
    f.extend(email.as_bytes());
    f
}

/// Create Unified OAuth Token Message (for antigravityUnifiedStateSync.oauthToken)
/// Structure (Reverse Engineered):
/// Outer Message:
///   Field 1: string "oauthTokenInfoSentinelKey"
///   Field 2: SubMessage
///       Field 1: string (Base64 encoded OAuthTokenInfo)
///           -> OAuthTokenInfo (Field 1: AccessToken, Field 2: Type, Field 3: RefreshToken, Field 4: Expiry)
pub fn create_unified_token_message(
    access_token: &str,
    refresh_token: &str,
    expiry: i64,
) -> Vec<u8> {
    // 1. Create inner OAuthTokenInfo (Field 1, 2, 3, 4)
    // Note: create_oauth_field returns it wrapped in Field 6 (Tag + Length + Content).
    // We need the RAW content of OAuthTokenInfo, not wrapped in Field 6.

    // Field 1: access_token
    let tag1 = (1 << 3) | 2;
    let field1 = {
        let mut f = encode_varint(tag1);
        f.extend(encode_varint(access_token.len() as u64));
        f.extend(access_token.as_bytes());
        f
    };

    // Field 2: token_type "Bearer"
    let tag2 = (2 << 3) | 2;
    let token_type = "Bearer";
    let field2 = {
        let mut f = encode_varint(tag2);
        f.extend(encode_varint(token_type.len() as u64));
        f.extend(token_type.as_bytes());
        f
    };

    // Field 3: refresh_token
    let tag3 = (3 << 3) | 2;
    let field3 = {
        let mut f = encode_varint(tag3);
        f.extend(encode_varint(refresh_token.len() as u64));
        f.extend(refresh_token.as_bytes());
        f
    };

    // Field 4: expiry
    let timestamp_tag = (1 << 3) | 0;
    let timestamp_msg = {
        let mut m = encode_varint(timestamp_tag);
        m.extend(encode_varint(expiry as u64));
        m
    };
    let tag4 = (4 << 3) | 2;
    let field4 = {
        let mut f = encode_varint(tag4);
        f.extend(encode_varint(timestamp_msg.len() as u64));
        f.extend(timestamp_msg);
        f
    };

    let oauth_info_raw = [field1, field2, field3, field4].concat();

    // 2. Base64 Encode the Raw OAuthTokenInfo
    // Use standard config, but we need to check if url_safe is preferred.
    // The dump used standard alphabet (no -_), but let's stick to standard as per our imports.
    // Wait, the dump in Step 9063 had `+` and `/`, so it IS Standard Base64.
    let oauth_info_b64 = base64::engine::general_purpose::STANDARD.encode(&oauth_info_raw);

    // 3. Wrap in SubMessage -> Field 1
    let sub_tag1 = (1 << 3) | 2;
    let sub_field1 = {
        let mut f = encode_varint(sub_tag1);
        f.extend(encode_varint(oauth_info_b64.len() as u64));
        f.extend(oauth_info_b64.as_bytes());
        f
    };

    // The SubMessage only contains Field 1
    let sub_message = sub_field1;

    // 4. Wrap SubMessage in Outer Message -> Field 2
    let outer_tag2 = (2 << 3) | 2;
    let outer_field2 = {
        let mut f = encode_varint(outer_tag2);
        f.extend(encode_varint(sub_message.len() as u64));
        f.extend(sub_message);
        f
    };

    // 5. Outer Field 1: sentinel string
    let sentinel = "oauthTokenInfoSentinelKey";
    let outer_tag1 = (1 << 3) | 2;
    let outer_field1 = {
        let mut f = encode_varint(outer_tag1);
        f.extend(encode_varint(sentinel.len() as u64));
        f.extend(sentinel.as_bytes());
        f
    };

    // Payload: Field 1 (Sentinel) + Field 2 (TokenWrapper)
    let payload = [outer_field1, outer_field2].concat();

    // 6. Wrap EVERYTHING in a Top-Level Field 1
    // The DB dump shows the entire content is inside Field 1.
    let root_tag1 = (1 << 3) | 2;
    let root_field1 = {
        let mut f = encode_varint(root_tag1);
        f.extend(encode_varint(payload.len() as u64));
        f.extend(payload);
        f
    };

    root_field1
}

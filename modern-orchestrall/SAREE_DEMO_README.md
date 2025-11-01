# Saree Demo Backend Implementation

This document describes the implementation of the Option A saree demo backend for generating photorealistic on-model images, cinematic videos, and 2.5D interactive assets from a single saree product image.

## Overview

The implementation provides a complete Fastify backend with the following endpoints:

### API Endpoints

#### POST /demo/saree/ingest
- **Description**: Downloads and stores a saree product image
- **Body**: `{ productImageUrl: string }`
- **Response**: `{ assetId: string, sourceUrl: string }`

#### POST /demo/saree/tryon
- **Description**: Generates virtual try-on images using Replicate
- **Body**: `{ assetId: string, avatarSpec?: AvatarSpec }`
- **Response**: `{ jobId: string, images: string[], count: number }`

#### POST /demo/saree/video
- **Description**: Generates cinematic video using Luma/Runway/Pika
- **Body**: `{ assetId: string, keyframeUrl?: string, style?: VideoStyle }`
- **Response**: `{ jobId: string, videoUrl: string, provider: string }`

#### POST /demo/saree/depthmap
- **Description**: Generates depth map and surface normals
- **Body**: `{ assetId: string, imageUrl?: string }`
- **Response**: `{ depthUrl: string, normalsUrl: string, cameraParams: object, provider: string }`

#### GET /demo/saree/status/:assetId
- **Description**: Returns asset status and signed URLs
- **Response**: Complete asset information with all available URLs

#### GET /demo/saree/embed/:assetId
- **Description**: Returns HTML embed with carousel, video player, and 2.5D canvas
- **Response**: HTML string

## Architecture

### Service Layer
- **SareeService**: Main orchestrator handling business logic
- **S3StorageService**: AWS S3 integration for file storage and signed URLs
- **Provider Clients**: Modular provider interfaces (Replicate, Video, Depth)

### Database
- **Asset Model**: Tracks assets with status, URLs, and metadata
- **Organization Integration**: Multi-tenant support

### Security
- **Authentication**: JWT-based with existing auth system
- **URL Validation**: SSRF protection with allowlist
- **Input Validation**: Zod schemas for all endpoints

## Configuration

### Environment Variables
```bash
# Local Storage Configuration
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
ASSET_BASE_URL=http://localhost:3000/uploads

# Demo Configuration
REPLICATE_API_TOKEN=your-replicate-api-token
VIDEO_PROVIDER=luma
LUMA_API_KEY=your-luma-api-key
RUNWAY_API_KEY=your-runway-api-key
PIKA_API_KEY=your-pika-api-key
DEPTH_PROVIDER=local

# AWS S3 Configuration (optional, for production)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_SAREE_BUCKET=orchestrall-saree-demo
```

## Features

### Virtual Try-On
- 4-6 high-res stills (1024-1536px)
- Multiple poses (front, side, three-quarter)
- Customizable avatar specifications
- Indian model prompts with realistic skin tones

### Video Generation
- 8-15s 1080p MP4 videos
- Multiple styles (studio turntable, runway subtle)
- Provider abstraction (Luma, Runway, Pika)
- Async processing with job tracking

### 2.5D Depth Mapping
- Depth map generation using MiDaS/Zoedepth
- Surface normals for silk sheen effect
- Camera parameters for parallax effects
- Interactive canvas with hover/drag parallax

### Storage & Delivery
- Local file storage with public URLs
- Automatic file organization by asset ID
- Secure URL generation with TTL
- Easy deployment without external dependencies
- S3-compatible interface for future migration

## Testing

### Unit Tests
- Provider client functionality
- URL validation and security
- Configuration validation
- Mock provider responses

### API Tests
- Endpoint validation
- Authentication flows
- Error handling
- Response schemas

## Usage Example

```javascript
// 1. Ingest saree image
const ingest = await fetch('/demo/saree/ingest', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    productImageUrl: 'https://kankatala.com/saree.jpg'
  })
});
const { assetId } = await ingest.json();

// 2. Generate try-on images
const tryon = await fetch('/demo/saree/tryon', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    assetId,
    avatarSpec: {
      skinTone: 'medium',
      hair: 'long',
      pose: 'front',
      background: 'studio'
    }
  })
});

// 3. Generate video
const video = await fetch('/demo/saree/video', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    assetId,
    style: 'studioTurntable'
  })
});

// 4. Generate depth map
const depth = await fetch('/demo/saree/depthmap', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ assetId })
});

// 5. Get embed HTML
const embed = await fetch(`/demo/saree/embed/${assetId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Deployment Notes

- Requires PostgreSQL with Asset model migration
- Local file storage (no external dependencies needed)
- API keys for external providers (Replicate, Video providers)
- Environment-specific configuration
- Monitoring and logging integration
- Storage directory automatically created

## Future Enhancements

- Additional video providers
- Real-time processing status
- Batch processing capabilities
- Enhanced 2.5D interactions
- Custom avatar templates
- Quality scoring and filtering
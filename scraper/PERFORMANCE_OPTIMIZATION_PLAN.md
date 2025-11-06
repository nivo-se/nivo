# Performance Optimization Plan - Reduce Scrape Time to Hours

## Current Performance (5-10k companies)
- **Stage 1**: ~8-16 hours (sequential)
- **Stage 2**: ~50-100 minutes (10 concurrent)
- **Stage 3**: ~17-33 hours (5 concurrent)
- **Total**: ~35-50 hours

## Target Performance
- **Total**: 2-4 hours for 5-10k companies

## Optimization Strategy

### 1. Stage 1 (Segmentation) - Parallel Page Processing
**Current**: Sequential (1 page at a time)
**Target**: 10-20 concurrent pages

**Changes**:
- Process multiple pages in parallel using `Promise.all`
- Batch size: 20 pages per batch
- Concurrency: 10-20 concurrent page fetches
- **Expected time reduction**: 8-16 hours → 30-60 minutes (10-20x faster)

**Implementation**:
```typescript
const pagesPerBatch = 20;
const concurrency = 15; // Concurrent page fetches

// Process pages in parallel batches
for (let batchStart = 1; batchStart <= maxPages; batchStart += pagesPerBatch) {
  const pageBatch = [];
  for (let page = batchStart; page < Math.min(batchStart + pagesPerBatch, maxPages + 1); page++) {
    pageBatch.push(page);
  }
  
  // Process pages concurrently
  const chunks = [];
  for (let i = 0; i < pageBatch.length; i += concurrency) {
    chunks.push(pageBatch.slice(i, i + concurrency));
  }
  
  for (const chunk of chunks) {
    const promises = chunk.map(page => fetchSegmentationPage(...));
    await Promise.all(promises);
  }
}
```

### 2. Stage 2 (Company ID Enrichment) - Increase Concurrency
**Current**: 10 concurrent
**Target**: 20-30 concurrent

**Changes**:
- Increase concurrency from 10 to 25
- Increase batch size from 50 to 100
- Remove/minimize delays between chunks
- **Expected time reduction**: 50-100 minutes → 20-40 minutes (2-3x faster)

**Implementation**:
```typescript
const batchSize = 100; // Increased from 50
const concurrency = 25; // Increased from 10
// Remove delay: await new Promise(resolve => setTimeout(resolve, 100));
```

### 3. Stage 3 (Financial Data) - Dramatically Increase Concurrency
**Current**: 5 concurrent
**Target**: 30-50 concurrent

**Changes**:
- Increase concurrency from 5 to 40
- Increase batch size from 50 to 100
- Remove any delays
- **Expected time reduction**: 17-33 hours → 2-4 hours (8-10x faster)

**Implementation**:
```typescript
const batchSize = 100; // Increased from 50
const concurrency = 40; // Increased from 5
// Process in larger chunks with higher concurrency
```

### 4. Remove Unnecessary Delays
**Current**: Delays between chunks/batches
**Target**: Minimal/no delays

**Changes**:
- Remove 100ms delay in Stage 2
- Remove any delays in Stage 3
- Only add delays if rate limiting is detected
- **Expected time reduction**: 5-10% overall

### 5. Optimize Database Operations
**Current**: Individual inserts/updates
**Target**: Batch operations where possible

**Changes**:
- Batch database updates (already done for inserts)
- Reduce database update frequency (update every 100 items instead of every chunk)
- **Expected time reduction**: 2-5% overall

### 6. Consider Parallel Stage Processing (Advanced)
**Current**: Sequential stages (Stage 1 → Stage 2 → Stage 3)
**Target**: Process Stage 2 and Stage 3 in parallel where possible

**Note**: This requires careful coordination but could save significant time.

## Implementation Priority

### Phase 1 (Critical - Immediate Impact)
1. ✅ Stage 3: Increase concurrency to 40
2. ✅ Stage 1: Add parallel page processing (15 concurrent)
3. ✅ Stage 2: Increase concurrency to 25

**Expected Result**: 35-50 hours → 3-5 hours

### Phase 2 (Optimization)
4. Remove delays
5. Optimize batch sizes
6. Fine-tune concurrency based on proxy performance

**Expected Result**: 3-5 hours → 2-4 hours

## Risk Mitigation

### Proxy Rate Limiting
- **Risk**: High concurrency may trigger rate limits
- **Mitigation**: 
  - Start with conservative concurrency (20-30)
  - Monitor proxy response times
  - Implement exponential backoff on 429 errors
  - Reduce concurrency if rate limits detected

### Database Performance
- **Risk**: High concurrency may slow database writes
- **Mitigation**:
  - Batch database operations
  - Use transactions for bulk inserts
  - Monitor database performance

### Memory Usage
- **Risk**: High concurrency may increase memory usage
- **Mitigation**:
  - Process in batches (not all at once)
  - Monitor memory usage
  - Increase Node.js memory limit if needed

## Testing Strategy

1. **Small Test** (100 companies):
   - Verify all optimizations work
   - Measure actual performance
   - Identify bottlenecks

2. **Medium Test** (1k companies):
   - Validate proxy can handle high concurrency
   - Measure database performance
   - Fine-tune concurrency levels

3. **Large Test** (5-10k companies):
   - Full production run
   - Monitor for errors
   - Optimize based on results

## Expected Final Performance

**Optimistic** (40 concurrent Stage 3, 25 concurrent Stage 2, 15 concurrent Stage 1):
- Stage 1: 30-60 minutes
- Stage 2: 20-40 minutes
- Stage 3: 2-4 hours
- **Total**: 2.5-5 hours

**Realistic** (30 concurrent Stage 3, 20 concurrent Stage 2, 10 concurrent Stage 1):
- Stage 1: 45-90 minutes
- Stage 2: 30-60 minutes
- Stage 3: 3-6 hours
- **Total**: 4-8 hours

## Monitoring

Track these metrics during large scrape:
- Requests per second
- Proxy response times
- Error rates (429, 502, 525)
- Database write performance
- Memory usage
- CPU usage

## Next Steps

1. Implement Phase 1 optimizations
2. Test with small batch (100 companies)
3. Adjust concurrency based on results
4. Test with medium batch (1k companies)
5. Fine-tune for large scrape (5-10k companies)


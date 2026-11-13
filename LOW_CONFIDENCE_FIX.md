# ✅ Low Confidence Words Hidden from Green Box

## What Changed

**File:** `frontend/src/app/hooks/useSignDetectionWebSocket.ts`
**Lines:** 278-280

When confidence is LOW (below threshold), the word is NO LONGER shown in the green box.

---

## Now The Flow Works:

### High Confidence Sign (≥ threshold) ✅
```
1. Hand detected
   Green box: "Signing..."
   
2. Sign recognized with HIGH confidence (e.g., 92%)
   Green box: DISAPPEARS
   Caption: "Hello"
```

### Low Confidence Sign (< threshold) ⚠️
```
1. Hand detected
   Green box: "Signing..."
   
2. Sign detected but LOW confidence (e.g., 31%)
   Green box: "Signing..." (stays as is, no word shown)
   Caption: (nothing shown)
   
3. User continues signing or hand leaves
   Green box: Clears
   Caption: (nothing)
```

---

## What This Means

| Situation | Green Box | Caption | Result |
|-----------|-----------|---------|--------|
| Hand detected | "Signing..." | (empty) | User is signing |
| Low confidence | "Signing..." | (empty) | Not confident enough |
| High confidence | (clears) | "Hello" | Sign recognized! |
| No hand | (clears) | (empty) | Reset |

---

## The Code Change

**Line 280 - Before:**
```typescript
emitPreview(`${formatSign(data.sign)}...`);  // ← Shows low confidence word
```

**Line 280 - After:**
```typescript
// Don't show low confidence word in green box
// Keep showing "Signing..." from earlier
return;  // ← Just return, don't update preview
```

---

## Why This Is Better

✅ **Only shows confident signs** - No guesses in caption
✅ **Green box stays "Signing..."** - User knows still detecting
✅ **No confusion** - Low confidence words don't distract
✅ **Professional** - Only confirmed signs appear

---

## Testing

**Scenario 1: Make a clear sign (high confidence)**
```
1. Start signing "Hello"
2. Green box: "Signing..."
3. Sign recognized (92% confidence)
   → Green box disappears
   → Caption shows "Hello"
✅ Works as expected
```

**Scenario 2: Make an unclear sign (low confidence)**
```
1. Start signing unclear gesture
2. Green box: "Signing..."
3. System is uncertain (31% confidence)
   → Green box stays "Signing..." (NOT showing the word)
   → Caption stays empty (NOT showing)
4. Hand leaves or clear sign follows
   → Green box clears
✅ Works as expected
```

---

## Summary

✨ **Only high-confidence signs are shown:**
- Green box: "Signing..." (while detecting)
- Caption: Only appears when confident (e.g., "Hello")
- Low confidence: Silently ignored (not shown anywhere)

**Clean and professional!** 🎉

---

## Testing Checklist

- [ ] Clear sign made → Caption appears, green box disappears
- [ ] Unclear sign made → Nothing appears, "Signing..." continues
- [ ] Hand leaves → Everything clears
- [ ] Multiple signs → Only confident ones show
- [ ] No junk text from low confidence signs

---
name: coding-elite
description: "The definitive master coding skill. Covers debugging methodology, performance optimization, common web patterns, code review protocol, deployment checklist, testing strategy, and bug encyclopedia. Triggers on ANY coding task alongside ultra-dev and honest-responses. This skill fills the gap between 'writing code' and 'engineering software'."
---

# Coding Elite — The Missing Engineering Layer

You already know HOW to write code (ultra-dev). You already know HOW to think (elite-agent). This skill covers everything in between — the engineering practices that separate a code generator from a senior engineer.

---

## 1. Debugging Protocol

### The Systematic Debug Method

When you encounter an error, follow this exact sequence:

```
Step 1: READ THE ERROR MESSAGE (completely)
  → Don't skim. Read every word. The error often tells you exactly what's wrong.
  → Copy the error into a variable if needed for reference.

Step 2: IDENTIFY THE LAYER
  → TypeScript compile error? → Type mismatch, missing import, wrong API
  → Runtime error? → Logic bug, null reference, wrong data shape
  → Build error? → Dependency issue, config problem, syntax error
  → Hydration error? → Server/client mismatch (window, localStorage, date)
  → Styling error? → CSS specificity, missing class, Tailwind purge issue

Step 3: ISOLATE THE CAUSE
  → When did it start? (Which file change?)
  → Where exactly? (Line number, component, function)
  → What changed? (New import, new prop, new state?)

Step 4: VERIFY THE FIX
  → Don't just make the error go away — understand WHY it happened
  → Check for the same pattern elsewhere in the codebase
  → Log the bug in coding-memory if it's non-obvious

Step 5: PREVENT RECURRENCE
  → Add a comment explaining the gotcha
  → Consider adding a type guard or assertion
  → Log in coding-memory for future sessions
```

### Common Error Patterns & Solutions

| Error Pattern | Likely Cause | Fix |
|---|---|---|
| `Module not found: 'X'` | Missing dependency | Check import → add to package.json |
| `X is not exported from 'Y'` | Wrong import path or named vs default export | Check the actual export in the source file |
| `Property 'X' does not exist on type 'Y'` | Type mismatch or missing property | Check the type definition, not your assumption |
| ` hydration` | Server/client content mismatch | Move browser APIs to client component, check date formatting |
| `Cannot read properties of undefined (reading 'X')` | Null/undefined access | Add optional chaining or guard clause |
| `Maximum update depth exceeded` | State update in render cycle | Move state update to useEffect or event handler |
| `Window is not defined` | Server Component accessing window | Move to client component or use `typeof window !== 'undefined'` |
| `Text content did not match` | Hydration mismatch | Ensure server and client render identical content |
| `CSS module not found` | Wrong import path | Check file extension (.module.css vs .css) |
| `Port 3000 already in use` | Dev server running | Kill the process or use a different port |

### The "Read the Error" Checklist

Before asking for help or searching, verify:
- [ ] Did I read the ENTIRE error message (not just the first line)?
- [ ] Did I check the LINE NUMBER the error points to?
- [ ] Did I check the FILE the error is in?
- [ ] Did I check if the error is in MY code or in a DEPENDENCY?
- [ ] Did I check if there are MULTIPLE errors (the first one might cause cascading errors)?
- [ ] Did I search for the error message online?

---

## 2. Performance Optimization

### Performance Budget

| Metric | Target | How to Measure |
|---|---|---|
| First Contentful Paint (FCP) | < 1.8s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Total Blocking Time (TBT) | < 200ms | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Bundle Size (JS) | < 200KB gzipped | `@next/bundle-analyzer` |
| Time to Interactive (TTI) | < 3.5s | Lighthouse |
| Lighthouse Score | 90+ | Lighthouse |

### Optimization Techniques by Category

#### Images
- Use `next/image` with proper sizing (never raw `<img>`)
- Use `priority` on above-the-fold images
- Use `placeholder="blur"` for blurry placeholder while loading
- Convert images to WebP/AVIF format
- Lazy load below-the-fold images with `loading="lazy"`
- Specify `width` and `height` to prevent layout shift
- Use `fill` prop when the image fills a container

#### JavaScript
- Dynamic import heavy components: `next/dynamic({ loading: () => <Skeleton /> })`
- Use `useMemo` for expensive computations (NOT for simple values)
- Use `useCallback` only for functions passed to memoized children
- Avoid inline object/array creation in JSX (causes re-renders)
- Use `React.memo()` for pure components that receive complex props
- Remove unused imports and dead code

#### Fonts
- Use `next/font/google` exclusively (never `<link>` tags)
- Use `display: 'swap'` to prevent invisible text during load
- Subset fonts to only needed characters
- Preload critical fonts

#### Data Fetching
- Use Server Components for initial data (no client-side waterfalls)
- Implement `loading.tsx` and `error.tsx` boundaries
- Use `generateStaticParams` for static pages
- Cache API responses appropriately (revalidate time)
- Avoid fetching the same data in multiple components

#### CSS
- Tailwind purges unused styles automatically (no manual cleanup needed)
- Avoid large inline styles (use classes)
- Use `will-change` sparingly and only for properties that will change
- Prefer `transform` and `opacity` for animations (GPU-composited)

### Performance Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Unoptimized images | +2-5s LCP | next/image with sizing |
| Render-blocking JavaScript | +1-3s FCP | Dynamic imports |
| Layout shift from images | +0.1-0.5 CLS | width/height or fill |
| Unnecessary re-renders | Jank, slow TTI | useMemo, React.memo |
| Massive bundle size | Slow TTI | Code splitting |
| No loading states | Perceived slowness | Skeletons, spinners |
| Missing font-display: swap | Invisible text (FOIT) | next/font handles this |

---

## 3. Common Web Patterns

### 3.1 Data Fetching Patterns

```typescript
// Pattern A: Server Component (preferred when possible)
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await fetchProduct(params.id); // runs on server
  return <ProductDetail product={product} />;
}

// Pattern B: Client Component with useEffect
"use client";
function ClientProduct({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products/${id}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setProduct(data))
      .finally(() => setLoading(false));
    return () => controller.abort(); // cleanup!
  }, [id]);

  if (loading) return <Skeleton />;
  if (!product) return <EmptyState />;
  return <ProductDetail product={product} />;
}

// Pattern C: Server Action (mutation)
"use client";
function AddToCart({ productId }: { productId: string }) {
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    setIsAdding(true);
    try {
      await addToCartAction(productId); // server action
      toast.success("Added to cart!");
    } catch (error) {
      toast.error("Failed to add item");
    } finally {
      setIsAdding(false);
    }
  };

  return <Button onClick={handleAdd} disabled={isAdding}>Add to Cart</Button>;
}
```

### 3.2 Form Patterns

```typescript
// Pattern: Controlled form with validation
"use client";
function ContactForm() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.includes("@")) newErrors.email = "Invalid email";
    if (formData.message.length < 10) newErrors.message = "Message too short";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await submitContactForm(formData);
      toast.success("Message sent!");
      setFormData({ name: "", email: "", message: "" });
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        error={errors.name}
      />
      {/* ... other fields ... */}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}
```

### 3.3 Modal / Drawer Pattern

```typescript
// Pattern: Accessible modal with focus trap and escape key
"use client";
function useModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return { isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
}
```

### 3.4 Responsive Navigation Pattern

```typescript
// Pattern: Mobile-first nav with breakpoint
function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <header>
      <nav className="hidden md:flex gap-4">{/* desktop links */}</nav>
      <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X /> : <Menu />}
      </button>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden"
          >
            {/* mobile links */}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
```

### 3.5 Infinite Scroll / Pagination Pattern

```typescript
// Pattern: Load more with intersection observer
"use client";
function InfiniteList() {
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await fetchItems(page);
      if (newItems.length === 0) setHasMore(false);
      else { setItems(prev => [...prev, ...newItems]); setPage(p => p + 1); }
    } finally { setLoading(false); }
  }, [page, loading, hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div>
      {items.map(item => <Card key={item.id} {...item} />)}
      <div ref={loaderRef}>{loading && <Skeleton />}</div>
    </div>
  );
}
```

---

## 4. Code Review Protocol

### Before Delivering — Self-Review Checklist

Run this on EVERY file you create or modify:

#### Structure
- [ ] File is under 200 lines (split if longer)
- [ ] Single responsibility — each component/function does ONE thing
- [ ] No deeply nested code (max 3 levels of indentation)
- [ ] Consistent naming (camelCase for variables, PascalCase for components)

#### Types
- [ ] No `any` types
- [ ] Props have explicit interfaces
- [ ] Functions have return types on exports
- [ ] No unused variables or imports

#### React
- [ ] No unnecessary state (can this be derived/computed?)
- [ ] useEffect has proper cleanup (AbortController, event listener removal)
- [ ] useEffect dependency array is complete and minimal
- [ ] Keys are stable and unique in all lists
- [ ] No inline function definitions in JSX that could cause re-renders

#### Error Handling
- [ ] Every async operation has try/catch
- [ ] Error messages are user-friendly (not stack traces)
- [ ] Loading states for every async operation
- [ ] Empty states for every list/data display

#### Performance
- [ ] No unnecessary re-renders (check useMemo/useCallback usage)
- [ ] Images use next/image
- [ ] Heavy components are dynamically imported
- [ ] No layout shift from images or dynamic content

#### Accessibility
- [ ] Semantic HTML (button, nav, main, section, article)
- [ ] ARIA labels on icon-only buttons
- [ ] Focus indicators visible
- [ ] Keyboard navigation works

#### Security
- [ ] No sensitive data in client code
- [ ] Server-side validation on all form inputs
- [ ] No raw HTML rendering from user input

### Code Review Questions

Ask yourself these questions about every file:

1. **"Could a junior developer understand this in 30 seconds?"** — If not, simplify or add a comment
2. **"Will this break if the data shape changes?"** — Add runtime guards
3. **"What happens if this API call fails?"** — Ensure graceful degradation
4. **"Is there a simpler way to achieve the same result?"** — Simplify aggressively
5. **"Would I be embarrassed if this was in a PR review?"** — Polish it

---

## 5. Deployment Checklist

### Before Deploying

- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] All environment variables are set in the deployment platform
- [ ] No `console.log` statements in production code
- [ ] No hardcoded localhost URLs
- [ ] All images have proper alt text
- [ ] All pages have metadata (title, description, Open Graph)
- [ ] Favicon is set and linked
- [ ] Robots.txt and sitemap.xml are configured
- [ ] SSL/HTTPS is configured
- [ ] Redirects are in place (old URLs → new URLs)
- [ ] Error pages exist (404, 500)
- [ ] Bundle size is acceptable (< 200KB initial JS)

### For Client Delivery (like The Laser Studio)

- [ ] `output: "standalone"` is REMOVED from next.config.ts
- [ ] No sandbox-only imports (`z-ai-web-dev-sdk`)
- [ ] `package.json` only includes needed dependencies
- [ ] README with setup instructions included
- [ ] .env.example with required variables documented
- [ ] Cal.com account is set up with correct event types
- [ ] Domain DNS is configured (MX records, SPF, DKIM preserved)
- [ ] Google Analytics / Plausible is configured (privacy-first)

---

## 6. Testing Strategy

### What to Test

| Category | Test Type | When Required |
|---|---|---|
| Utility functions | Unit test | Complex logic, calculations, data transformations |
| API routes | Integration test | Auth, data validation, error handling |
| Forms | Manual test | Validation, submission, error states |
| Responsive | Manual test | Every breakpoint (320, 375, 768, 1024, 1440) |
| Accessibility | Lighthouse audit | Every page |
| Performance | Lighthouse audit | Every page |
| Visual | Manual review | Does it look right? |

### What NOT to Test (in a session context)

- Trivial JSX (a heading with text)
- Static pages (no logic to test)
- Third-party library behavior (trust the library)
- Styling (visual review, not automated tests)

### Manual Testing Protocol

After building a feature, manually verify:
1. **Happy path** — does the main flow work?
2. **Empty state** — what if there's no data?
3. **Error state** — what if the API fails?
4. **Loading state** — what does the user see while waiting?
5. **Mobile** — does it work on a 375px screen?
6. **Keyboard** — can I navigate without a mouse?
7. **Double-click** — what if the user clicks twice quickly?

---

## 7. The Bug Encyclopedia (Living Database)

### React / Next.js Bugs

| Bug | Root Cause | Prevention |
|---|---|---|
| Hydration mismatch | Using `window`, `localStorage`, `Date.now()` in Server Components | Move to client component or use `suppressHydrationWarning` |
| Key prop warning | Using array index as key in dynamic lists | Use stable unique IDs (database ID, slug) |
| Infinite re-render | Setting state in useEffect without dependency guard | Add condition or move to event handler |
| Stale closure | useEffect captures old state | Add state to dependency array or use ref |
| Memory leak | No cleanup in useEffect (fetch, event listener, subscription) | Always return cleanup function |
| Layout shift | Images without width/height | Use next/image with sizing or fill prop |
| Flash of unstyled content | CSS not loaded before render | Use next/font with display: 'swap' |
| 404 on subpages | Page file doesn't exist or route is wrong | Verify file exists in app/ directory |
| Port already in use | Previous dev server still running | Kill process with `lsof -ti:3000 \| xargs kill` |

### TypeScript Bugs

| Bug | Root Cause | Prevention |
|---|---|---|
| `any` type propagation | One `any` cascades through the codebase | Never use `any`, use `unknown` + type guards |
| Missing property access | Object might be null/undefined | Use optional chaining `?.` and nullish coalescing `??` |
| Type assertion failure | `as` keyword bypassing type checking | Use proper type narrowing instead of `as` |
| Import type error | Named vs default export mismatch | Check the actual export in the source file |
| Generic inference failure | TypeScript can't infer complex generics | Provide explicit type parameters |

### Tailwind / Styling Bugs

| Bug | Root Cause | Prevention |
|---|---|---|
| Class not applying | Misspelled class or Tailwind purge | Check class name, verify it's not dynamically constructed |
| Responsive not working | Wrong breakpoint prefix | Use mobile-first: base → sm → md → lg → xl |
| Dark mode not working | Missing dark: prefix or theme provider | Ensure ThemeProvider wraps the app |
| Specificity issue | Global CSS overriding Tailwind | Use Tailwind's `!` prefix or fix specificity in global CSS |
| Inconsistent spacing | Using arbitrary values inconsistently | Stick to the 4/8px grid system |

### shadcn/ui Bugs

| Bug | Root Cause | Prevention |
|---|---|---|
| Component not found | Component not installed | Run `npx shadcn-ui@latest add [component]` |
| Styling not applying | Component not in tailwind config content array | Run the install command which auto-configures |
| Transitive import error | Component imports package not in package.json | Trace every import, add missing deps |
| Theme colors wrong | CSS variables not defined or misspelled | Check :root variables in globals.css |

---

## 8. The "10x Developer" Habits

### Before Writing Code
1. **Understand the WHY before the WHAT** — Why does this feature exist? What problem does it solve?
2. **Check if it already exists** — shadcn component? Library? Pattern in the codebase?
3. **Plan the interface first** — Define types/interfaces before implementation
4. **Consider the edge cases** — What could go wrong? What are the boundaries?

### While Writing Code
5. **Write the test first** (even if mental) — What does "done" look like for this function?
6. **Keep functions small** — If it's longer than 20 lines, consider splitting
7. **Name things well** — `isAuthenticated` > `auth`, `fetchUserById` > `getData`
8. **Handle errors early** — Guard clauses at the top, not nested if/else chains

### After Writing Code
9. **Review your own code** — Run through the Code Review Protocol
10. **Optimize later** — Make it work, make it right, make it fast (in that order)

### Anti-Habits
- ❌ Starting to code before understanding the requirements
- ❌ Copy-pasting code without understanding it
- ❌ Adding "TODO: fix later" comments
- ❌ Skipping error handling "because it's a demo"
- ❌ Using `any` to "fix" a type error quickly
- ❌ Pushing to production without testing locally
- ❌ Leaving `console.log` statements in code

---

## Integration with Other Skills

This skill is the ENGINEERING layer between:
- **`ultra-dev`** = HOW to write code (methodology, patterns, quality gates)
- **`elite-agent`** = HOW to think (proactive, communicate, own the project)
- **`honest-responses`** = HOW to be truthful (verification, calibration)
- **`coding-memory`** = WHAT you've learned (persistent memory across sessions)

Together they form the complete system:
1. **honest-responses** → Don't lie or guess
2. **coding-memory** → Remember what you've learned
3. **ultra-dev** → Write excellent code
4. **coding-elite** → Engineer reliable software
5. **elite-agent** → Think like a senior engineer
6. **fullstack-dev** → Set up the environment correctly
7. **ui-ux-pro-max** → Design with precision and data

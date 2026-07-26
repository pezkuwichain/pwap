// Minimal in-memory Supabase stand-in.
//
// Implements exactly the query-builder surface the council/KYC handlers use:
//   .from(t).insert(v)
//   .from(t).select(cols).eq(c,v).single()
//   .from(t).select('*', { count:'exact', head:true }).eq(...).eq(...)
//   .from(t).update(v).eq(c,v)
//   .from(t).select(cols).eq(c,v)   (list)
// Unique-violation (23505) is simulated on council_members.address and
// kyc_proposals.user_address so the 409 paths are covered. Everything lives in
// plain arrays — no network, no real DB.

export function makeFakeSupabase (initial = {}) {
  const tables = {
    council_members: [],
    kyc_proposals: [],
    votes: [],
    ...structuredCloneSafe(initial)
  }

  const UNIQUE = {
    council_members: 'address',
    kyc_proposals: 'user_address'
  }

  function from (name) {
    const rows = tables[name] || (tables[name] = [])
    const builder = {
      _filters: [],
      _count: null,
      _head: false,
      _update: null,

      insert (vals) {
        const arr = Array.isArray(vals) ? vals : [vals]
        for (const v of arr) {
          const uniqueCol = UNIQUE[name]
          if (uniqueCol && rows.some(r => r[uniqueCol] === v[uniqueCol])) {
            return Promise.resolve({ error: { code: '23505' }, data: null })
          }
          rows.push({ id: rows.length + 1, executed: false, created_at: new Date().toISOString(), ...v })
        }
        return Promise.resolve({ error: null, data: null })
      },

      select (cols, opts) {
        if (opts) {
          this._count = opts.count || null
          this._head = !!opts.head
        }
        return this
      },

      eq (col, val) {
        this._filters.push([col, val])
        return this
      },

      neq () { return this },

      update (vals) {
        this._update = vals
        return this
      },

      _apply () {
        return rows.filter(r => this._filters.every(([c, v]) => r[c] === v))
      },

      single () {
        const found = this._apply()
        if (found.length === 0) {
          return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
        }
        return Promise.resolve({ data: found[0], error: null })
      },

      // Thenable terminal for chains awaited without .single()
      then (resolve, reject) {
        try {
          const found = this._apply()
          if (this._update) {
            found.forEach(r => Object.assign(r, this._update))
            return resolve({ error: null, data: found })
          }
          if (this._count) {
            return resolve({ count: found.length, error: null, data: this._head ? null : found })
          }
          return resolve({ data: found, error: null })
        } catch (err) {
          return reject(err)
        }
      }
    }
    return builder
  }

  return { from, _tables: tables }
}

function structuredCloneSafe (obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) out[k] = v.map(r => ({ ...r }))
  return out
}

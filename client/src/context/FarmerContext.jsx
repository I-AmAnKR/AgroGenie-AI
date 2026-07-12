import { createContext, useContext, useReducer, useEffect } from 'react'
import { getProfile } from '../api/profile.api.js'

const FarmerContext = createContext(null)

const initialState = {
  profile: null,
  loading: true,
  error: null
}

function farmerReducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':  return { ...state, loading: true, error: null }
    case 'LOAD_SUCCESS': return { ...state, loading: false, profile: action.payload }
    case 'LOAD_ERROR':  return { ...state, loading: false, error: action.payload }
    case 'UPDATE':      return { ...state, profile: { ...state.profile, ...action.payload } }
    default: return state
  }
}

export function FarmerProvider({ children }) {
  const [state, dispatch] = useReducer(farmerReducer, initialState)

  useEffect(() => {
    dispatch({ type: 'LOAD_START' })
    getProfile()
      .then(res => dispatch({ type: 'LOAD_SUCCESS', payload: res.data }))
      .catch(err => dispatch({ type: 'LOAD_ERROR', payload: err.error?.message ?? 'Failed to load profile' }))
  }, [])

  const updateProfile = (data) => dispatch({ type: 'UPDATE', payload: data })

  return (
    <FarmerContext.Provider value={{ ...state, updateProfile }}>
      {children}
    </FarmerContext.Provider>
  )
}

export function useFarmer() {
  const ctx = useContext(FarmerContext)
  if (!ctx) throw new Error('useFarmer must be used inside FarmerProvider')
  return ctx
}

import client from './client.js'

export async function getMyCertifications() {
  const response = await client.get('/certifications/me')
  return response.data
}

export async function uploadCertification(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const response = await client.post('/certifications/upload', {
    data_base64: String(dataUrl).split(',')[1],
    mime_type: file.type,
    original_name: file.name,
  })
  return response.data.certification
}

export async function getPendingCertifications() {
  const response = await client.get('/admin/certifications')
  return response.data.certifications
}

export async function approveCertification(id) {
  const response = await client.post(`/admin/certifications/${id}/approve`)
  return response.data.certification
}

export async function rejectCertification(id, reason) {
  const response = await client.post(`/admin/certifications/${id}/reject`, {
    rejection_reason: reason,
  })
  return response.data.certification
}

export async function openCertificationMaterial(id, audience) {
  const prefix = audience === 'admin' ? '/admin/certifications' : '/certifications'
  const response = await client.get(`${prefix}/${id}/material`, {
    responseType: 'blob',
  })
  const objectUrl = URL.createObjectURL(response.data)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}


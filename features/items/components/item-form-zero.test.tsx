import '../../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ItemForm } from './item-form'
test('editing zero-stock material displays zero in quantity and value calculation', () => {
 render(React.createElement(ItemForm, {
  action: async()=>({success:false}),categories:[],locations:[],units:[],
  item: {id:'zero-material',item_name:'Paper',item_type:'material',quantity:0,unit_price:10,
   asset_no:null,serial_no:null,responsible_person:null,status:'active',updated_at:'',created_at:'',
   category:null,unit:null,location:null,brand:null,model:null,note:null,image_url:null}
 }))
 assert.equal((screen.getByLabelText(/^จำนวน/) as HTMLInputElement).value,'0')
 assert.ok(screen.getByText(/0 × ฿10\.00/))
})
